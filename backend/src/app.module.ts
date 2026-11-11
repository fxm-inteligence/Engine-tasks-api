import { TaskAuditLogServiceModule } from "./task-audit-log-service/task-audit-log-service.module";
import { TaskIdempotencyKeyServiceModule } from "./task-idempotency-key-service/task-idempotency-key-service.module";
import { TaskStatusLogServiceModule } from "./task-status-log-service/task-status-log-service.module";
import { TasksServiceModule } from "./tasks-service/tasks-service.module";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: Number(process.env.RATE_LIMIT_MAX ?? 100) }]), TasksServiceModule, TaskStatusLogServiceModule, TaskAuditLogServiceModule, TaskIdempotencyKeyServiceModule],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
