// Yours: a Regenerate never overwrites this file. Each hook runs around the Service method of the same name.
import type { Hooks } from "../with-hooks";
import type { TaskStatusLogService } from "./task-status-log-service.service";

export const hooks: Hooks<TaskStatusLogService> = {
  before: {
    // listTaskStatusLogs(...) { /* throw to refuse the call */ },
    // getTaskStatusLog(...) { /* throw to refuse the call */ },
  },
  after: {
    // listTaskStatusLogs(result, ...) { return result; },
    // getTaskStatusLog(result, ...) { return result; },
  },
};
