import { TaskIdempotencyKeyRepository } from "./task-idempotency-key-repository.repository";
import { TaskIdempotencyKeyServiceController } from "./task-idempotency-key-service.controller";
import { TaskIdempotencyKeyService } from "./task-idempotency-key-service.service";
import { Module } from "@nestjs/common";

@Module({
  controllers: [TaskIdempotencyKeyServiceController],
  providers: [TaskIdempotencyKeyService, TaskIdempotencyKeyRepository],
})
export class TaskIdempotencyKeyServiceModule {}
