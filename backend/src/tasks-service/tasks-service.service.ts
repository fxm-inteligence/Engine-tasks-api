import { ListQuery } from "../list-query";
import { withHooks } from "../with-hooks";
import { CreateTasksRequestDto } from "./dto/create-tasks-request.dto";
import { UpdateTasksRequestDto } from "./dto/update-tasks-request.dto";
import { TasksRepository } from "./tasks-repository.repository";
import { hooks } from "./tasks-service.hooks";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class TasksService {
  constructor(private readonly tasksRepository: TasksRepository) {}

  listTaskses(query: ListQuery) {
    return this.tasksRepository.findPage(query);
  }

  async getTasks(id: string) {
    const record = await this.tasksRepository.findById(id);
    if (!record) throw new NotFoundException();
    return record;
  }

  createTasks(dto: CreateTasksRequestDto) {
    return this.tasksRepository.create(dto);
  }

  async updateTasks(id: string, dto: UpdateTasksRequestDto) {
    const record = await this.tasksRepository.findById(id);
    if (!record) throw new NotFoundException();
    return this.tasksRepository.update(id, dto);
  }

  async deleteTasks(id: string) {
    const record = await this.tasksRepository.findById(id);
    if (!record) throw new NotFoundException();
    return this.tasksRepository.remove(id);
  }
}

withHooks(TasksService.prototype, hooks);
