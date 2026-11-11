// Generated from the logic blocks of the "Task" table. A Regenerate rewrites this file, so change the blocks, not the file.
// Code of your own goes in tasks-service.hooks.ts and in the *.custom.ts files, which a Regenerate leaves alone.
import { createHash } from "node:crypto";
import { ConflictException, HttpException } from "@nestjs/common";
import { callerId, idempotencyKey, callerRole } from "../request-context";
import { inTransaction } from "../transaction-scope";
import type { Hooks } from "../with-hooks";
import type { TasksRepository } from "./tasks-repository.repository";
import type { TaskAuditLogRepository } from "./task-audit-log-repository.repository";
import type { TaskIdempotencyKeyRepository } from "./task-idempotency-key-repository.repository";
import type { TaskStatusLogRepository } from "./task-status-log-repository.repository";
import type { TasksService } from "./tasks-service.service";

type Row = Record<string, any>;

function toDate(value: unknown): Date | undefined {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** One queue per lock key: the next request for the same key waits until the one before has been saved. */
const queues = new Map<string, Promise<void>>();

async function exclusive<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((resolve) => (release = resolve));
  const tail = previous.then(() => mine);
  queues.set(key, tail);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (queues.get(key) === tail) queues.delete(key);
  }
}

/**
 * Runs `work` in one transaction: what it writes through the Repositories (the record, the balance, the history, the
 * audit log) is kept or dropped together. Holding keys, the next request for the same key waits until the one before has
 * been saved: on PostgreSQL the lock also holds against other processes, and is taken in the transaction; with another
 * database it holds in this process only.
 */
async function locked<T>(keys: string[], work: () => Promise<T>): Promise<T> {
  const withDatabase = () =>
    inTransaction(async (transaction) => {
      if (transaction !== undefined && keys.length > 0 && /^postgres(ql)?:/.test(process.env.DATABASE_URL ?? "")) {
        for (const key of keys) {
          await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
        }
      }
      return work();
    });
  return keys.reduceRight<() => Promise<T>>((next, key) => () => exclusive(key, next), withDatabase)();
}

const lockedCalls: Record<string, "create" | "update" | "remove"> = {
  "createTasks": "create",
  "updateTasks": "update",
  "patchTasks": "update",
  "deleteTasks": "remove",
};

/** Wraps the calls of the Service so what each writes is kept or dropped together. Apply after `withHooks`: the transaction is the outermost step. */
export function lockSlots<T extends object>(target: T): T {
  const record = target as Record<string, unknown>;
  for (const name of Object.keys(lockedCalls)) {
    const original = record[name] as (...args: unknown[]) => Promise<unknown>;
    record[name] = async function (this: any, ...args: unknown[]) {
      return locked([], () => original.apply(this, args));
    };
  }
  return target;
}

// Status Flow "Task Steps"
const flowTaskStepsNext: Record<string, readonly string[]> = {
  "todo": ["doing","done"],
  "doing": ["todo","done"],
  "done": [],
};

/** True when "status" may change from `from` to `to`; a status the flow does not list is not checked. */
export function flowTaskStepsAllows(from: unknown, to: unknown): boolean {
  if (typeof from !== "string" || typeof to !== "string" || from === to) return true;
  const known = (status: string) => Object.prototype.hasOwnProperty.call(flowTaskStepsNext, status);
  if (!known(from) || !known(to)) return true;
  return flowTaskStepsNext[from].includes(to);
}

/** Refuses (409) a change of "status" the flow does not allow. */
function flowTaskStepsCheck(current: Row, changed: Row): void {
  const to = changed["status"];
  if (to === undefined) return;
  const from = current["status"];
  if (!flowTaskStepsAllows(from, to)) {
    throw new ConflictException("A task cannot move from {from} to {to}".split("{from}").join(String(from)).split("{to}").join(String(to)));
  }
}

/** The statuses a record as `current` may change to now: the ones flowTaskStepsCheck lets through for this caller, in the order the flow lists them. */
export function flowTaskStepsTransitions(current: Row): string[] {
  const statuses = new Set<string>([...Object.keys(flowTaskStepsNext), ...Object.values(flowTaskStepsNext).flat()]);
  return [...statuses].filter((to) => {
    if (to === current["status"]) return false;
    try {
      flowTaskStepsCheck(current, { ["status"]: to });
      return true;
    } catch {
      return false;
    }
  });
}

/** The row of the history a call leaves: the status a created record starts with, or the one a changed record moves to. Nothing when the status stayed. */
export function flowTaskStepsHistory(kind: "create" | "update", before: Row | null, after: Row | null, id: unknown): Row | undefined {
  const to = after?.["status"];
  if (to === undefined || to === null || String(to) === "") return undefined;
  const from = kind === "update" ? String(before?.["status"] ?? "") : "";
  if (kind === "update" && from === String(to)) return undefined;
  return {
    "recordId": String(after?.["id"] ?? id),
    "fromStatus": from,
    "toStatus": String(to),
    "changedAt": Date.now() / 1000,
  };
}

const historyCalls: Record<string, "create" | "update"> = {
  "createTasks": "create",
  "updateTasks": "update",
  "patchTasks": "update",
};

/** Wraps the create and update calls of the Service so each change of status is kept as a row of the history. Apply after `withHooks`, inside `lockSlots`. */
export function keepHistory<T extends object>(target: T): T {
  const record = target as Record<string, unknown>;
  for (const [name, kind] of Object.entries(historyCalls)) {
    const original = record[name] as (...args: unknown[]) => Promise<unknown>;
    record[name] = async function (this: any, ...args: unknown[]) {
      const repository = (this as any).tasksRepository as TasksRepository;
      const before = kind === "update" ? ((await repository.findById(args[0] as any)) as Row | null) : null;
      const result = (await original.apply(this, args)) as Row | null;
      const entry = flowTaskStepsHistory(kind, before, result, args[0]);
      if (entry) await ((this as any).taskStatusLogRepository as TaskStatusLogRepository).create(entry as any);
      return result;
    };
  }
  return target;
}

// Audit "Task Trail"
const auditTaskTrailExcluded = new Set<string>([]);

/** JSON for the `changes` of a row: a Date is its ISO text and a bigint its digits. */
const auditTaskTrailJson = (value: unknown): string =>
  JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));

/** The fields a call changed, as `{ field: { from, to } }`: a created record has no `from`, a deleted one no `to`; the fields the Audit leaves out are not in it. */
export function auditTaskTrailChanges(kind: "create" | "update" | "remove", before: Row | null, after: Row | null): Record<string, { from?: unknown; to?: unknown }> {
  const changes: Record<string, { from?: unknown; to?: unknown }> = {};
  const names = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const name of names) {
    if (auditTaskTrailExcluded.has(name)) continue;
    const was = before?.[name];
    const now = after?.[name];
    if (kind === "create") {
      if (now !== undefined && now !== null) changes[name] = { to: now };
    } else if (kind === "remove") {
      if (was !== undefined && was !== null) changes[name] = { from: was };
    } else if (auditTaskTrailJson(was ?? null) !== auditTaskTrailJson(now ?? null)) {
      changes[name] = { from: was ?? null, to: now ?? null };
    }
  }
  return changes;
}

/** The row of the audit log a call leaves. Nothing when a change changed nothing, or a deletion found nothing to delete. */
export function auditTaskTrailEntry(kind: "create" | "update" | "remove", before: Row | null, after: Row | null, id: unknown, actor: string): Row | undefined {
  if (kind === "remove" && !before) return undefined;
  const changes = auditTaskTrailChanges(kind, before, after);
  if (kind === "update" && Object.keys(changes).length === 0) return undefined;
  const record = kind === "remove" ? before : after;
  return {
    "recordId": String(record?.["id"] ?? id),
    "action": kind === "remove" ? "delete" : kind,
    "actor": actor,
    "changes": auditTaskTrailJson(changes),
    "changedAt": Date.now() / 1000,
  };
}

const auditCalls: Record<string, "create" | "update" | "remove"> = {
  "createTasks": "create",
  "updateTasks": "update",
  "patchTasks": "update",
  "deleteTasks": "remove",
};

/** The updates that take no body: what they changed is what the record is afterwards, so it is read again. */
const auditRead = new Set<string>([]);

/** Wraps the calls of the Service that create, change or delete a record so each one is kept as a row of the audit log, with the id of whoever called it (empty for the system's own call). Apply after `withHooks`, inside `lockSlots`. */
export function keepAudit<T extends object>(target: T): T {
  const record = target as Record<string, unknown>;
  for (const [name, kind] of Object.entries(auditCalls)) {
    const original = record[name] as (...args: unknown[]) => Promise<unknown>;
    record[name] = async function (this: any, ...args: unknown[]) {
      const repository = (this as any).tasksRepository as TasksRepository;
      const before = kind === "create" ? null : ((await repository.findById(args[0] as any)) as Row | null);
      const result = (await original.apply(this, args)) as Row | null;
      const after = auditRead.has(name) ? ((await repository.findById(args[0] as any)) as Row | null) : result;
      const entry = auditTaskTrailEntry(kind, before, kind === "remove" ? null : after, args[0], callerId() ?? "");
      if (entry) await ((this as any).taskAuditLogRepository as TaskAuditLogRepository).create(entry as any);
      return result;
    };
  }
  return target;
}

// Idempotency "Task Once"
const idempotencyTaskOnceSeconds = 86400;
const idempotencyTaskOnceCalls = ["createTasks"];
const idempotencyTaskOnceBusy = new Map<string, Promise<unknown>>();

/** Orders the keys of every object, so the same body always gives the same text. */
function idempotencyTaskOnceCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(idempotencyTaskOnceCanonical);
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Row)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([name, item]) => [name, idempotencyTaskOnceCanonical(item)]),
    );
  }
  return value;
}

/** A hash of the body of a call. */
const idempotencyTaskOnceHash = (body: unknown): string =>
  createHash("sha256").update(JSON.stringify(idempotencyTaskOnceCanonical(body)) ?? "").digest("hex");

/** Wraps the calls of the Service that create a record: a repeat of the key a caller sent within the hours of the block gets the record the first call made. A call without the header is made as it is. Apply last, so a repeat runs none of the other blocks. */
export function keepIdempotency<T extends object>(target: T): T {
  const record = target as Record<string, unknown>;
  for (const name of idempotencyTaskOnceCalls) {
    const original = record[name] as (...args: unknown[]) => Promise<unknown>;
    record[name] = async function (this: any, ...args: unknown[]) {
      const header = idempotencyKey();
      if (!header) return original.apply(this, args);
      const scoped = `${callerId() ?? ""}:${header}`;
      const hash = idempotencyTaskOnceHash(args[0]);
      const earlier = idempotencyTaskOnceBusy.get(scoped) ?? Promise.resolve();
      const mine = earlier
        .catch(() => undefined)
        .then(() => inTransaction(async (transaction) => {
          // On PostgreSQL the key is also held against other processes, until the record and the key are saved together.
          if (transaction !== undefined && /^postgres(ql)?:/.test(process.env.DATABASE_URL ?? "")) {
            await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"idempotency:" + scoped}, 0))`;
          }
          const keys = (this as any).taskIdempotencyKeyRepository as TaskIdempotencyKeyRepository;
          const seen = (await keys.findByField("requestKey", scoped)) as Row | null;
          if (seen) {
            if (Date.now() / 1000 - Number(seen["createdAt"]) < idempotencyTaskOnceSeconds) {
              const first = seen["requestHash"];
              if (typeof first === "string" && first !== "" && first !== hash) throw new HttpException("This Idempotency-Key was already used with a different request body", 422);
              const found = await ((this as any).tasksRepository as TasksRepository).findById(seen["recordId"] as any);
              if (found) return found;
            }
            await keys.remove(seen.id as any);
          }
          const result = (await original.apply(this, args)) as Row;
          await keys.create({
            "requestKey": scoped,
            "recordId": String(result["id"]),
            "createdAt": Date.now() / 1000,
            "requestHash": hash,
          } as any);
          // The keys past their hours are of no use: a page of them goes with each key that is saved.
          const expired = (await keys.findPage({
            offset: 0,
            limit: 100,
            filters: { "createdAt_to": String(Date.now() / 1000 - idempotencyTaskOnceSeconds) },
          })).items as Row[];
          for (const old of expired) await keys.remove(old.id as any);
          return result;
        }));
      idempotencyTaskOnceBusy.set(scoped, mine);
      try {
        return await mine;
      } finally {
        if (idempotencyTaskOnceBusy.get(scoped) === mine) idempotencyTaskOnceBusy.delete(scoped);
      }
    };
  }
  return target;
}

export const logicHooks: Hooks<TasksService> = {
  before: {
    async updateTasks(this: any, id: any, dto: any) {
      const repository = (this as any).tasksRepository as TasksRepository;
      const current = await repository.findById(id);
      if (!current) return;
      flowTaskStepsCheck(current, dto);
    },
    async patchTasks(this: any, id: any, dto: any) {
      const repository = (this as any).tasksRepository as TasksRepository;
      const current = await repository.findById(id);
      if (!current) return;
      flowTaskStepsCheck(current, dto);
    },
  },
};
