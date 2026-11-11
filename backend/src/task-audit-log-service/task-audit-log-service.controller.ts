import { TOTAL_COUNT_HEADER, parseListQuery } from "../list-query";
import { AdminKeyGuard } from "./admin-key.guard";
import { TaskAuditLogService } from "./task-audit-log-service.service";
import { Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Response } from "express";

@ApiTags("TaskAuditLogService")
@Controller()
export class TaskAuditLogServiceController {
  constructor(private readonly taskAuditLogService: TaskAuditLogService) {}

  @UseGuards(AdminKeyGuard)
  @Get("/task-audit-logs")
  async listTaskAuditLogs(@Query() query: Record<string, unknown>, @Res({ passthrough: true }) response: Response) {
    const page = await this.taskAuditLogService.listTaskAuditLogs(parseListQuery(query));
    response.setHeader(TOTAL_COUNT_HEADER, page.total);
    return page.items;
  }

  @UseGuards(AdminKeyGuard)
  @Get("/task-audit-logs/:id")
  getTaskAuditLog(@Param("id") id: string) {
    return this.taskAuditLogService.getTaskAuditLog(id);
  }
}
