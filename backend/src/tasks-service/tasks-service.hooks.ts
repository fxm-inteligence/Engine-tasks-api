// Yours: a Regenerate never overwrites this file. Each hook runs around the Service method of the same name.
import type { Hooks } from "../with-hooks";
import type { TasksService } from "./tasks-service.service";

export const hooks: Hooks<TasksService> = {
  before: {
    // listTaskses(...) { /* throw to refuse the call */ },
    // getTasks(...) { /* throw to refuse the call */ },
    // createTasks(...) { /* throw to refuse the call */ },
    // updateTasks(...) { /* throw to refuse the call */ },
    // patchTasks(...) { /* throw to refuse the call */ },
    // deleteTasks(...) { /* throw to refuse the call */ },
  },
  after: {
    // listTaskses(result, ...) { return result; },
    // getTasks(result, ...) { return result; },
    // createTasks(result, ...) { return result; },
    // updateTasks(result, ...) { return result; },
    // patchTasks(result, ...) { return result; },
    // deleteTasks(result, ...) { return result; },
  },
};
