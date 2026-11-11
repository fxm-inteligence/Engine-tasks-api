import { TOTAL_COUNT_HEADER, parseListQuery } from "../list-query";
import { AdminKeyGuard } from "./admin-key.guard";
import { TaskStatusLogService } from "./task-status-log-service.service";
import { Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Response } from "express";

@ApiTags("TaskStatusLogService")
@Controller()
export class TaskStatusLogServiceController {
  constructor(private readonly taskStatusLogService: TaskStatusLogService) {}

  @UseGuards(AdminKeyGuard)
  @Get("/task-status-logs")
  async listTaskStatusLogs(@Query() query: Record<string, unknown>, @Res({ passthrough: true }) response: Response) {
    const page = await this.taskStatusLogService.listTaskStatusLogs(parseListQuery(query));
    response.setHeader(TOTAL_COUNT_HEADER, page.total);
    return page.items;
  }

  @UseGuards(AdminKeyGuard)
  @Get("/task-status-logs/:id")
  getTaskStatusLog(@Param("id") id: string) {
    return this.taskStatusLogService.getTaskStatusLog(id);
  }
}
