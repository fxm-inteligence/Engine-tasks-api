import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ConflictException } from "@nestjs/common";
import { runWithKey } from "../request-context";
import { flowTaskStepsAllows, keepAudit, keepHistory, keepIdempotency, logicHooks } from "./tasks-service.logic";

type Row = Record<string, any>;

/** Runs `work` the way a test without a database runs: a length that lives in another table is the default. */
async function withoutDatabase<T>(work: () => Promise<T>): Promise<T> {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    return await work();
  } finally {
    if (saved !== undefined) process.env.DATABASE_URL = saved;
  }
}

/** A Service whose Repository keeps `rows` in memory. */
function serviceWith(rows: Row[]) {
  const repository = {
    findPage: async () => ({ items: rows, total: rows.length }),
    findById: async (id: unknown) => rows.find((row) => row["id"] === id) ?? null,
  };
  return { tasksRepository: repository };
}

test("flowTaskSteps: todo may change to doing", () => {
  assert.equal(flowTaskStepsAllows("todo", "doing"), true);
});

test("flowTaskSteps: done may not change to todo", () => {
  assert.equal(flowTaskStepsAllows("done", "todo"), false);
});

test("flowTaskSteps: a status the flow does not list is not checked", () => {
  assert.equal(flowTaskStepsAllows("not-in-the-flow", "todo"), true);
  assert.equal(flowTaskStepsAllows(undefined, "todo"), true);
});

test("flowTaskSteps: updateTasks: a change the flow does not allow is refused with 409", async () => {
  const service = serviceWith([{ "id": "a", "status": "done" }]);
  await assert.rejects(async () => (logicHooks.before as any)["updateTasks"].call(service, "a", { "status": "todo" }), ConflictException);
});

test("flowTaskSteps: updateTasks: a change the flow allows goes through", async () => {
  const service = serviceWith([{ "id": "a", "status": "todo" }]);
  await (logicHooks.before as any)["updateTasks"].call(service, "a", { "status": "doing" });
});

test("flowTaskSteps: patchTasks: a change the flow does not allow is refused with 409", async () => {
  const service = serviceWith([{ "id": "a", "status": "done" }]);
  await assert.rejects(async () => (logicHooks.before as any)["patchTasks"].call(service, "a", { "status": "todo" }), ConflictException);
});

test("flowTaskSteps: patchTasks: a change the flow allows goes through", async () => {
  const service = serviceWith([{ "id": "a", "status": "todo" }]);
  await (logicHooks.before as any)["patchTasks"].call(service, "a", { "status": "doing" });
});

test("flowTaskSteps: history: a created record starts it, a changed status adds a row, an unchanged one adds nothing", async () => {
  const rows: Row[] = [{ "id": "a", "status": "todo" }];
  const kept: Row[] = [];
  const log = { create: async (row: Row) => (kept.push(row), row) };
  const service = keepHistory({
    ...serviceWith(rows),
    taskStatusLogRepository: log,
    async createTasks(body: Row) {
      const created = { "id": "b", ...body };
      rows.push(created);
      return created;
    },
    async updateTasks(id: unknown, body: Row) {
      // A new object, not a change in place: the history reads the old record before the call and must see the old status.
      const index = rows.findIndex((row) => row["id"] === id);
      rows[index] = { ...(rows[index] as Row), ...body };
      return rows[index];
    },
  });
  await service.createTasks({ "status": "todo" });
  await service.updateTasks("a", { "status": "not-in-the-flow" });
  await service.updateTasks("a", { "status": "not-in-the-flow" });
  const withoutTime = kept.map(({ "changedAt": changedAt, ...rest }) => (assert.equal(typeof changedAt, "number"), rest));
  assert.deepEqual(withoutTime, [{ "recordId": "b", "fromStatus": "", "toStatus": "todo" }, { "recordId": "a", "fromStatus": "todo", "toStatus": "not-in-the-flow" }]);
});

test("auditTaskTrail: audit: a created record, a changed field, an unchanged call and a deleted record each leave a row; a field left out never does", async () => {
  const auditauditTaskTrailRows: Row[] = [{ "id": "a", "title": "old" }];
  const kept: Row[] = [];
  const log = { create: async (entry: Row) => (kept.push(entry), entry) };
  const service = keepAudit({
    ...serviceWith(auditauditTaskTrailRows),
    taskAuditLogRepository: log,
    async createTasks(body: Row) {
      const created = { "id": "b", ...body };
      auditauditTaskTrailRows.push(created);
      return created;
    },
    async updateTasks(id: unknown, body: Row) {
      const index = auditauditTaskTrailRows.findIndex((row) => row["id"] === id);
      auditauditTaskTrailRows[index] = { ...(auditauditTaskTrailRows[index] as Row), ...body };
      return auditauditTaskTrailRows[index];
    },
    async deleteTasks(id: unknown) {
      auditauditTaskTrailRows.splice(auditauditTaskTrailRows.findIndex((row) => row["id"] === id), 1);
      return true;
    },
  });
  await service.createTasks({ "title": "fresh" });
  await service.updateTasks("a", { "title": "new" });
  await service.updateTasks("a", { "title": "new" });
  await service.deleteTasks("a");
  const withoutTime = kept.map(({ "changedAt": changedAt, ...rest }) => (assert.equal(typeof changedAt, "number"), rest));
  assert.deepEqual(withoutTime, [{ "recordId": "b", "action": "create", "actor": "", "changes": JSON.stringify({ "id": { to: "b" }, "title": { to: "fresh" } }) }, { "recordId": "a", "action": "update", "actor": "", "changes": JSON.stringify({ "title": { from: "old", to: "new" } }) }, { "recordId": "a", "action": "delete", "actor": "", "changes": JSON.stringify({ "id": { from: "a" }, "title": { from: "new" } }) }]);
});

test("idempotencyTaskOnce: idempotency: a repeated key answers the record the first call made, and with another body is refused (422); another key, another caller, an old key and no key make new ones", async () => {
  const idemRows: Row[] = [];
  const stored: Row[] = [];
  const log = {
    findByField: async (field: string, value: unknown) => stored.find((row) => row[field] === value) ?? null,
    findPage: async (query: { filters: Record<string, string> }) => ({
      items: stored.filter((row) => Number(row["createdAt"]) <= Number(query.filters["createdAt_to"])),
    }),
    create: async (row: Row) => (stored.push({ id: String(stored.length + 1), ...row }), row),
    remove: async (id: unknown) => (stored.splice(stored.findIndex((row) => row.id === id), 1), true),
  };
  const service = keepIdempotency({
    ...serviceWith(idemRows),
    taskIdempotencyKeyRepository: log,
    async createTasks(body: Row) {
      const created = { "id": String(idemRows.length + 1), ...body };
      idemRows.push(created);
      return created;
    },
  });
  const make = (token: string | undefined, caller = "") =>
    token === undefined
      ? service.createTasks({})
      : runWithKey(token, caller, () => service.createTasks({}));
  const first = await make("one");
  const again = await make("one");
  assert.equal(again["id"], first["id"]);
  assert.equal(idemRows.length, 1);
  await assert.rejects(
    () => runWithKey("one", "", () => service.createTasks({ other: 1 })),
    (error: any) => (error.status ?? error.getStatus?.()) === 422,
  );
  assert.equal(idemRows.length, 1);
  await make("two");
  await make("one", "someone");
  await make(undefined);
  await make(undefined);
  assert.equal(idemRows.length, 5);
  assert.equal(stored.length, 3);
  assert.equal(stored[0]?.["requestKey"], ":one");
  assert.equal(stored[2]?.["requestKey"], "someone:one");
  const old = stored[0] as Row;
  old["createdAt"] = Date.now() / 1000 - 86405;
  (stored[1] as Row)["createdAt"] = Date.now() / 1000 - 86405;
  const renewed = await make("one");
  assert.notEqual(renewed["id"], first["id"]);
  assert.equal(idemRows.length, 6);
  assert.equal(stored.filter((row) => row["requestKey"] === ":one").length, 1);
  assert.equal(stored.filter((row) => row["requestKey"] === ":two").length, 0);
});
