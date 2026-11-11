import { ListQuery } from "../list-query";
import { withHooks } from "../with-hooks";
import { TaskStatusLogRepository } from "./task-status-log-repository.repository";
import { hooks } from "./task-status-log-service.hooks";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class TaskStatusLogService {
  constructor(private readonly taskStatusLogRepository: TaskStatusLogRepository) {}

  listTaskStatusLogs(query: ListQuery) {
    return this.taskStatusLogRepository.findPage(query);
  }

  async getTaskStatusLog(id: string) {
    const record = await this.taskStatusLogRepository.findById(id);
    if (!record) throw new NotFoundException();
    return record;
  }
}

withHooks(TaskStatusLogService.prototype, hooks);
