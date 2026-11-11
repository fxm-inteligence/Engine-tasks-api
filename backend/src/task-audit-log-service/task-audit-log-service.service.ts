import { ListQuery } from "../list-query";
import { withHooks } from "../with-hooks";
import { TaskAuditLogRepository } from "./task-audit-log-repository.repository";
import { hooks } from "./task-audit-log-service.hooks";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class TaskAuditLogService {
  constructor(private readonly taskAuditLogRepository: TaskAuditLogRepository) {}

  listTaskAuditLogs(query: ListQuery) {
    return this.taskAuditLogRepository.findPage(query);
  }

  async getTaskAuditLog(id: string) {
    const record = await this.taskAuditLogRepository.findById(id);
    if (!record) throw new NotFoundException();
    return record;
  }
}

withHooks(TaskAuditLogService.prototype, hooks);
