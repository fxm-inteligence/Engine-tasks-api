import { TOTAL_COUNT_HEADER, parseListQuery, withNamedQuery } from "../list-query";
import { AdminKeyGuard } from "./admin-key.guard";
import { CreateTasksRequestDto } from "./dto/create-tasks-request.dto";
import { PatchTasksRequestDto } from "./dto/patch-tasks-request.dto";
import { UpdateTasksRequestDto } from "./dto/update-tasks-request.dto";
import { TasksService } from "./tasks-service.service";
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Response } from "express";

@ApiTags("TasksService")
@Controller()
export class TasksServiceController {
  constructor(private readonly tasksService: TasksService) {}

  @UseGuards(AdminKeyGuard)
  @Get("/tasks")
  async listTaskses(@Query() query: Record<string, unknown>, @Res({ passthrough: true }) response: Response) {
    const page = await this.tasksService.listTaskses(parseListQuery(withNamedQuery(query, { "open": { "status": "todo", "sort": "priority" }, "doing": { "status": "doing" }, "done": { "status": "done", "sort": "-createdAt", "limit": "20" } })));
    response.setHeader(TOTAL_COUNT_HEADER, page.total);
    return page.items;
  }

  @UseGuards(AdminKeyGuard)
  @Get("/tasks/:id")
  getTasks(@Param("id") id: string) {
    return this.tasksService.getTasks(id);
  }

  @UseGuards(AdminKeyGuard)
  @Post("/tasks")
  createTasks(@Body() dto: CreateTasksRequestDto) {
    return this.tasksService.createTasks(dto);
  }

  @UseGuards(AdminKeyGuard)
  @Put("/tasks/:id")
  updateTasks(@Param("id") id: string, @Body() dto: UpdateTasksRequestDto) {
    return this.tasksService.updateTasks(id, dto);
  }

  @UseGuards(AdminKeyGuard)
  @Patch("/tasks/:id")
  patchTasks(@Param("id") id: string, @Body() dto: PatchTasksRequestDto) {
    return this.tasksService.patchTasks(id, dto);
  }

  @UseGuards(AdminKeyGuard)
  @Delete("/tasks/:id")
  deleteTasks(@Param("id") id: string) {
    return this.tasksService.deleteTasks(id);
  }
}
