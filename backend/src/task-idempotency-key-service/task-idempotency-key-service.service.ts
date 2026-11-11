import { ListQuery } from "../list-query";
import { withHooks } from "../with-hooks";
import { TaskIdempotencyKeyRepository } from "./task-idempotency-key-repository.repository";
import { hooks } from "./task-idempotency-key-service.hooks";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class TaskIdempotencyKeyService {
  constructor(private readonly taskIdempotencyKeyRepository: TaskIdempotencyKeyRepository) {}

  listTaskIdempotencyKeys(query: ListQuery) {
    return this.taskIdempotencyKeyRepository.findPage(query);
  }

  async getTaskIdempotencyKey(id: string) {
    const record = await this.taskIdempotencyKeyRepository.findById(id);
    if (!record) throw new NotFoundException();
    return record;
  }
}

withHooks(TaskIdempotencyKeyService.prototype, hooks);
