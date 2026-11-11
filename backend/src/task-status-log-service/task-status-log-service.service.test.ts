import { strict as assert } from "node:assert";
import { test } from "node:test";
import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { TaskStatusLogRepository } from "./task-status-log-repository.repository";
import { TaskStatusLogService } from "./task-status-log-service.service";

type Row = Record<string, any>;

/** A Repository that keeps its rows in memory, so the Service is tested without a database. */
function setup() {
  const rows = new Map<any, Row>();
  let next = 1;
  const repository = {
    findPage: async () => ({ items: [...rows.values()], total: rows.size }),
    findById: async (id: any) => rows.get(id) ?? null,
    findByField: async (field: string, value: unknown) =>
      [...rows.values()].find((row) => row[field] === value) ?? null,
    create: async (data: Row) => {
      const row = { id: String(next++), ...data };
      rows.set(row.id, row);
      return row;
    },
    update: async (id: any, data: Row) => {
      const row = { ...rows.get(id), ...data };
      rows.set(id, row);
      return row;
    },
    remove: async (id: any) => {
      const row = rows.get(id);
      rows.delete(id);
      return row;
    },
  };
  const service = new TaskStatusLogService(repository as unknown as TaskStatusLogRepository);
  return { service: service as any, rows };
}

function sample(): Row {
  return { recordId: "sample", fromStatus: "sample", toStatus: "sample", changedAt: 1.5 };
}

test("getTaskStatusLog answers 404 for an id that does not exist", async () => {
  const { service } = setup();
  await assert.rejects(async () => service.getTaskStatusLog("missing-id"), NotFoundException);
});
