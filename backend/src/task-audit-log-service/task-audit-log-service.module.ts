import { TaskAuditLogRepository } from "./task-audit-log-repository.repository";
import { TaskAuditLogServiceController } from "./task-audit-log-service.controller";
import { TaskAuditLogService } from "./task-audit-log-service.service";
import { Module } from "@nestjs/common";

@Module({
  controllers: [TaskAuditLogServiceController],
  providers: [TaskAuditLogService, TaskAuditLogRepository],
})
export class TaskAuditLogServiceModule {}
