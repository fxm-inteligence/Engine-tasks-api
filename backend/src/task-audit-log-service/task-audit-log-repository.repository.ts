import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ambient } from "../transaction-scope";
import { readFilters, type FilterKind, type ListQuery, type Page } from "../list-query";

export interface TaskAuditLogRecord {
  id: string;
  recordId: string;
  action: string;
  actor?: string;
  changes?: string;
  changedAt: number;
}

function searchWhere(search: string | undefined) {
  if (search === undefined) return undefined;
  return {
    OR: [
      { recordId: { contains: search, mode: "insensitive" as const } },
      { action: { contains: search, mode: "insensitive" as const } },
      { actor: { contains: search, mode: "insensitive" as const } },
      { changes: { contains: search, mode: "insensitive" as const } },
    ],
  };
}

const FILTER_COLUMNS = new Map<string, FilterKind>([
  ["id", "uuid"],
  ["recordId", "text"],
  ["action", "text"],
  ["actor", "text"],
  ["changedAt", "number"],
]);

function listWhere(query: ListQuery) {
  const conditions: Record<string, unknown>[] = readFilters(query.filters, FILTER_COLUMNS).map(
    ({ field, operator, value }) =>
      value === undefined
        ? { id: { in: [] } }
        : { [field]: operator === "equals" ? value : { [operator]: value } },
  );
  const search = searchWhere(query.search);
  if (search) conditions.push(search);
  return { AND: conditions };
}

function orderBy(sort: ListQuery["sort"]) {
  const direction = sort?.descending ? ("desc" as const) : ("asc" as const);
  switch (sort?.field) {
    case "id":
      return [{ id: direction }];
    case "recordId":
      return [{ recordId: direction }, { id: "asc" as const }];
    case "action":
      return [{ action: direction }, { id: "asc" as const }];
    case "actor":
      return [{ actor: direction }, { id: "asc" as const }];
    case "changes":
      return [{ changes: direction }, { id: "asc" as const }];
    case "changedAt":
      return [{ changedAt: direction }, { id: "asc" as const }];
    default:
      return [{ id: "asc" as const }];
  }
}

@Injectable()
export class TaskAuditLogRepository {
  private readonly prisma = ambient(new PrismaClient());

  findPage(query: ListQuery): Promise<Page<TaskAuditLogRecord>> {
    return Promise.all([
      this.prisma.taskAuditLog.findMany({ where: listWhere(query), orderBy: orderBy(query.sort), skip: query.offset, take: query.limit }),
      this.prisma.taskAuditLog.count({ where: listWhere(query) }),
    ]).then(([rows, total]) => ({ items: rows, total }));
  }

  findById(id: TaskAuditLogRecord["id"]): Promise<TaskAuditLogRecord | null> {
    return this.prisma.taskAuditLog.findUnique({ where: { id } });
  }

  findByField(field: keyof TaskAuditLogRecord & string, value: unknown): Promise<TaskAuditLogRecord | null> {
    return this.prisma.taskAuditLog.findFirst({ where: { [field]: value } });
  }

  create(data: Omit<TaskAuditLogRecord, "id">): Promise<TaskAuditLogRecord> {
    return this.prisma.taskAuditLog.create({ data });
  }

  update(id: TaskAuditLogRecord["id"], data: Partial<Omit<TaskAuditLogRecord, "id">>): Promise<TaskAuditLogRecord> {
    return this.prisma.taskAuditLog.update({ where: { id }, data });
  }

  remove(id: TaskAuditLogRecord["id"]): Promise<TaskAuditLogRecord> {
    return this.prisma.taskAuditLog.delete({ where: { id } });
  }
}
