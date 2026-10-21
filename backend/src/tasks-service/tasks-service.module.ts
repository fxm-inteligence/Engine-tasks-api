import { TasksRepository } from "./tasks-repository.repository";
import { TasksServiceController } from "./tasks-service.controller";
import { TasksService } from "./tasks-service.service";
import { Module } from "@nestjs/common";

@Module({
  controllers: [TasksServiceController],
  providers: [TasksService, TasksRepository],
})
export class TasksServiceModule {}
