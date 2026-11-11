import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ambient } from "../transaction-scope";
import { readFilters, type FilterKind, type ListQuery, type Page } from "../list-query";

export interface TaskRecord {
  id: string;
  title: string;
  done?: boolean;
  status?: string;
  priority?: number;
  dueAt?: Date;
  createdAt?: Date;
}

function searchWhere(search: string | undefined) {
  if (search === undefined) return undefined;
  return {
    OR: [
      { title: { contains: search, mode: "insensitive" as const } },
      { status: { contains: search, mode: "insensitive" as const } },
    ],
  };
}

const FILTER_COLUMNS = new Map<string, FilterKind>([
  ["id", "uuid"],
  ["title", "text"],
  ["done", "boolean"],
  ["status", "text"],
  ["priority", "integer"],
  ["dueAt", "datetime"],
  ["createdAt", "datetime"],
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
    case "title":
      return [{ title: direction }, { id: "asc" as const }];
    case "done":
      return [{ done: direction }, { id: "asc" as const }];
    case "status":
      return [{ status: direction }, { id: "asc" as const }];
    case "priority":
      return [{ priority: direction }, { id: "asc" as const }];
    case "dueAt":
      return [{ dueAt: direction }, { id: "asc" as const }];
    case "createdAt":
      return [{ createdAt: direction }, { id: "asc" as const }];
    default:
      return [{ id: "asc" as const }];
  }
}

@Injectable()
export class TasksRepository {
  private readonly prisma = ambient(new PrismaClient());

  findPage(query: ListQuery): Promise<Page<TaskRecord>> {
    return Promise.all([
      this.prisma.task.findMany({ where: listWhere(query), orderBy: orderBy(query.sort), skip: query.offset, take: query.limit }),
      this.prisma.task.count({ where: listWhere(query) }),
    ]).then(([rows, total]) => ({ items: rows, total }));
  }

  findById(id: TaskRecord["id"]): Promise<TaskRecord | null> {
    return this.prisma.task.findUnique({ where: { id } });
  }

  findByField(field: keyof TaskRecord & string, value: unknown): Promise<TaskRecord | null> {
    return this.prisma.task.findFirst({ where: { [field]: value } });
  }

  create(data: Omit<TaskRecord, "id">): Promise<TaskRecord> {
    return this.prisma.task.create({ data });
  }

  update(id: TaskRecord["id"], data: Partial<Omit<TaskRecord, "id">>): Promise<TaskRecord> {
    return this.prisma.task.update({ where: { id }, data });
  }

  remove(id: TaskRecord["id"]): Promise<TaskRecord> {
    return this.prisma.task.delete({ where: { id } });
  }
}
