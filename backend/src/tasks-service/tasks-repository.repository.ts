import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import type { ListQuery, Page } from "../list-query";

export interface TaskRecord {
  id: string;
  title: string;
  done?: boolean;
}

function searchWhere(search: string | undefined) {
  if (search === undefined) return undefined;
  return {
    OR: [
      { title: { contains: search, mode: "insensitive" as const } },
    ],
  };
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
    default:
      return [{ id: "asc" as const }];
  }
}

@Injectable()
export class TasksRepository {
  private readonly prisma = new PrismaClient();

  findPage(query: ListQuery): Promise<Page<TaskRecord>> {
    return Promise.all([
      this.prisma.task.findMany({ where: searchWhere(query.search), orderBy: orderBy(query.sort), skip: query.offset, take: query.limit }),
      this.prisma.task.count({ where: searchWhere(query.search) }),
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
