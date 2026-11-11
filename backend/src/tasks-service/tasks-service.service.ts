import { checkRules } from "../auth-crypto";
import { ListQuery } from "../list-query";
import { withHooks } from "../with-hooks";
import { CreateTasksRequestDto } from "./dto/create-tasks-request.dto";
import { PatchTasksRequestDto } from "./dto/patch-tasks-request.dto";
import { UpdateTasksRequestDto } from "./dto/update-tasks-request.dto";
import { TaskAuditLogRepository } from "./task-audit-log-repository.repository";
import { TaskIdempotencyKeyRepository } from "./task-idempotency-key-repository.repository";
import { TaskStatusLogRepository } from "./task-status-log-repository.repository";
import { TasksRepository } from "./tasks-repository.repository";
import { hooks } from "./tasks-service.hooks";
import { keepAudit, keepHistory, keepIdempotency, lockSlots, logicHooks } from "./tasks-service.logic";
import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";

@Injectable()
export class TasksService {
  constructor(private readonly tasksRepository: TasksRepository, private readonly taskStatusLogRepository: TaskStatusLogRepository, private readonly taskAuditLogRepository: TaskAuditLogRepository, private readonly taskIdempotencyKeyRepository: TaskIdempotencyKeyRepository) {}

  listTaskses(query: ListQuery) {
    return this.tasksRepository.findPage(query);
  }

  async getTasks(id: string) {
    const record = await this.tasksRepository.findById(id);
    if (!record) throw new NotFoundException();
    return record;
  }

  createTasks(dto: CreateTasksRequestDto) {
    const problems = checkRules(dto, [["title", "required", ""], ["title", "minLength", "3"], ["title", "maxLength", "120"], ["priority", "min", "1"], ["priority", "max", "5"]], false);
    if (problems.length > 0) throw new UnprocessableEntityException(problems.join("; "));
    return this.tasksRepository.create({ ...dto, dueAt: dto.dueAt === undefined ? undefined : new Date(dto.dueAt), createdAt: dto.createdAt === undefined ? undefined : new Date(dto.createdAt) });
  }

  async updateTasks(id: string, dto: UpdateTasksRequestDto) {
    const problems = checkRules(dto, [["title", "required", ""], ["title", "minLength", "3"], ["title", "maxLength", "120"], ["priority", "min", "1"], ["priority", "max", "5"]], false);
    if (problems.length > 0) throw new UnprocessableEntityException(problems.join("; "));
    const record = await this.tasksRepository.findById(id);
    if (!record) throw new NotFoundException();
    return this.tasksRepository.update(id, { ...dto, dueAt: dto.dueAt === undefined ? undefined : new Date(dto.dueAt), createdAt: dto.createdAt === undefined ? undefined : new Date(dto.createdAt) });
  }

  async patchTasks(id: string, dto: PatchTasksRequestDto) {
    const problems = checkRules(dto, [["title", "required", ""], ["title", "minLength", "3"], ["title", "maxLength", "120"], ["priority", "min", "1"], ["priority", "max", "5"]], true);
    if (problems.length > 0) throw new UnprocessableEntityException(problems.join("; "));
    const record = await this.tasksRepository.findById(id);
    if (!record) throw new NotFoundException();
    return this.tasksRepository.update(id, { ...dto, dueAt: dto.dueAt === undefined ? undefined : new Date(dto.dueAt), createdAt: dto.createdAt === undefined ? undefined : new Date(dto.createdAt) });
  }

  async deleteTasks(id: string) {
    const record = await this.tasksRepository.findById(id);
    if (!record) throw new NotFoundException();
    return this.tasksRepository.remove(id);
  }
}

withHooks(TasksService.prototype, hooks);
withHooks(TasksService.prototype, logicHooks);
keepHistory(TasksService.prototype);
keepAudit(TasksService.prototype);
lockSlots(TasksService.prototype);
keepIdempotency(TasksService.prototype);
