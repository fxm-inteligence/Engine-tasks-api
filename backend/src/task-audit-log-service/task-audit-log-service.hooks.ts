// Yours: a Regenerate never overwrites this file. Each hook runs around the Service method of the same name.
import type { Hooks } from "../with-hooks";
import type { TaskAuditLogService } from "./task-audit-log-service.service";

export const hooks: Hooks<TaskAuditLogService> = {
  before: {
    // listTaskAuditLogs(...) { /* throw to refuse the call */ },
    // getTaskAuditLog(...) { /* throw to refuse the call */ },
  },
  after: {
    // listTaskAuditLogs(result, ...) { return result; },
    // getTaskAuditLog(result, ...) { return result; },
  },
};
