import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ambient } from "../transaction-scope";
import { readFilters, type FilterKind, type ListQuery, type Page } from "../list-query";

export interface TaskIdempotencyKeyRecord {
  id: string;
  requestKey: string;
  recordId: string;
  createdAt: number;
  requestHash?: string;
}

function searchWhere(search: string | undefined) {
  if (search === undefined) return undefined;
  return {
    OR: [
      { requestKey: { contains: search, mode: "insensitive" as const } },
      { recordId: { contains: search, mode: "insensitive" as const } },
      { requestHash: { contains: search, mode: "insensitive" as const } },
    ],
  };
}

const FILTER_COLUMNS = new Map<string, FilterKind>([
  ["id", "uuid"],
  ["requestKey", "text"],
  ["recordId", "text"],
  ["createdAt", "number"],
  ["requestHash", "text"],
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
    case "requestKey":
      return [{ requestKey: direction }, { id: "asc" as const }];
    case "recordId":
      return [{ recordId: direction }, { id: "asc" as const }];
    case "createdAt":
      return [{ createdAt: direction }, { id: "asc" as const }];
    case "requestHash":
      return [{ requestHash: direction }, { id: "asc" as const }];
    default:
      return [{ id: "asc" as const }];
  }
}

@Injectable()
export class TaskIdempotencyKeyRepository {
  private readonly prisma = ambient(new PrismaClient());

  findPage(query: ListQuery): Promise<Page<TaskIdempotencyKeyRecord>> {
    return Promise.all([
      this.prisma.taskIdempotencyKey.findMany({ where: listWhere(query), orderBy: orderBy(query.sort), skip: query.offset, take: query.limit }),
      this.prisma.taskIdempotencyKey.count({ where: listWhere(query) }),
    ]).then(([rows, total]) => ({ items: rows, total }));
  }

  findById(id: TaskIdempotencyKeyRecord["id"]): Promise<TaskIdempotencyKeyRecord | null> {
    return this.prisma.taskIdempotencyKey.findUnique({ where: { id } });
  }

  findByField(field: keyof TaskIdempotencyKeyRecord & string, value: unknown): Promise<TaskIdempotencyKeyRecord | null> {
    return this.prisma.taskIdempotencyKey.findFirst({ where: { [field]: value } });
  }

  create(data: Omit<TaskIdempotencyKeyRecord, "id">): Promise<TaskIdempotencyKeyRecord> {
    return this.prisma.taskIdempotencyKey.create({ data });
  }

  update(id: TaskIdempotencyKeyRecord["id"], data: Partial<Omit<TaskIdempotencyKeyRecord, "id">>): Promise<TaskIdempotencyKeyRecord> {
    return this.prisma.taskIdempotencyKey.update({ where: { id }, data });
  }

  remove(id: TaskIdempotencyKeyRecord["id"]): Promise<TaskIdempotencyKeyRecord> {
    return this.prisma.taskIdempotencyKey.delete({ where: { id } });
  }
}
