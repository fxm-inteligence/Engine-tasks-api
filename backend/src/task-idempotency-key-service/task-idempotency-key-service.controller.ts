import { TOTAL_COUNT_HEADER, parseListQuery } from "../list-query";
import { AdminKeyGuard } from "./admin-key.guard";
import { TaskIdempotencyKeyService } from "./task-idempotency-key-service.service";
import { Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Response } from "express";

@ApiTags("TaskIdempotencyKeyService")
@Controller()
export class TaskIdempotencyKeyServiceController {
  constructor(private readonly taskIdempotencyKeyService: TaskIdempotencyKeyService) {}

  @UseGuards(AdminKeyGuard)
  @Get("/task-idempotency-keys")
  async listTaskIdempotencyKeys(@Query() query: Record<string, unknown>, @Res({ passthrough: true }) response: Response) {
    const page = await this.taskIdempotencyKeyService.listTaskIdempotencyKeys(parseListQuery(query));
    response.setHeader(TOTAL_COUNT_HEADER, page.total);
    return page.items;
  }

  @UseGuards(AdminKeyGuard)
  @Get("/task-idempotency-keys/:id")
  getTaskIdempotencyKey(@Param("id") id: string) {
    return this.taskIdempotencyKeyService.getTaskIdempotencyKey(id);
  }
}
