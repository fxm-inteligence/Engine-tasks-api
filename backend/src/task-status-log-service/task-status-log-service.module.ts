import { TaskStatusLogRepository } from "./task-status-log-repository.repository";
import { TaskStatusLogServiceController } from "./task-status-log-service.controller";
import { TaskStatusLogService } from "./task-status-log-service.service";
import { Module } from "@nestjs/common";

@Module({
  controllers: [TaskStatusLogServiceController],
  providers: [TaskStatusLogService, TaskStatusLogRepository],
})
export class TaskStatusLogServiceModule {}
