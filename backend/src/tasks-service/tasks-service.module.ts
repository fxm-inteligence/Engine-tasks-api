import { TaskAuditLogRepository } from "./task-audit-log-repository.repository";
import { TaskIdempotencyKeyRepository } from "./task-idempotency-key-repository.repository";
import { TaskStatusLogRepository } from "./task-status-log-repository.repository";
import { TasksRepository } from "./tasks-repository.repository";
import { TasksServiceController } from "./tasks-service.controller";
import { TasksService } from "./tasks-service.service";
import { Module } from "@nestjs/common";

@Module({
  controllers: [TasksServiceController],
  providers: [TasksService, TasksRepository, TaskStatusLogRepository, TaskAuditLogRepository, TaskIdempotencyKeyRepository],
})
export class TasksServiceModule {}
