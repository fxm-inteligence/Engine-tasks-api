import { strict as assert } from "node:assert";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { TasksRepository } from "./tasks-repository.repository";
import { TasksService } from "./tasks-service.service";

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
  const service = new TasksService(repository as unknown as TasksRepository);
  return { service: service as any, rows };
}

function sample(): Row {
  return { title: "sample", done: true };
}

test("createTasks stores the record and answers with its id", async () => {
  const { service, rows } = setup();
  const created = await service.createTasks(sample() as never);
  assert.notEqual(created.id, undefined);
  assert.equal(rows.size, 1);
  assert.equal(created.title, sample().title);
});

test("listTaskses answers with the stored records and their total", async () => {
  const { service } = setup();
  await service.createTasks(sample() as never);
  const page = await service.listTaskses({ search: undefined, sort: undefined, offset: 0, limit: undefined });
  assert.equal(page.total, 1);
  assert.equal(page.items.length, 1);
});

test("getTasks answers with the stored record", async () => {
  const { service } = setup();
  const created = await service.createTasks(sample() as never);
  const found = await service.getTasks(created.id);
  assert.equal(found.id, created.id);
});

test("getTasks answers 404 for an id that does not exist", async () => {
  const { service } = setup();
  await assert.rejects(() => service.getTasks("missing-id"), NotFoundException);
});

test("updateTasks changes the stored record", async () => {
  const { service, rows } = setup();
  const created = await service.createTasks(sample() as never);
  await service.updateTasks(created.id, { title: "updated" } as never);
  assert.equal(rows.get(created.id)?.title, "updated");
});

test("updateTasks answers 404 for an id that does not exist", async () => {
  const { service } = setup();
  await assert.rejects(() => service.updateTasks("missing-id", { title: "updated" } as never), NotFoundException);
});

test("deleteTasks removes the record", async () => {
  const { service, rows } = setup();
  const created = await service.createTasks(sample() as never);
  await service.deleteTasks(created.id);
  assert.equal(rows.size, 0);
});

test("deleteTasks answers 404 for an id that does not exist", async () => {
  const { service } = setup();
  await assert.rejects(() => service.deleteTasks("missing-id"), NotFoundException);
});
