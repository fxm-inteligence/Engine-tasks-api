// Yours: a Regenerate never overwrites this file. Each hook runs around the Service method of the same name.
import type { Hooks } from "../with-hooks";
import type { TaskIdempotencyKeyService } from "./task-idempotency-key-service.service";

export const hooks: Hooks<TaskIdempotencyKeyService> = {
  before: {
    // listTaskIdempotencyKeys(...) { /* throw to refuse the call */ },
    // getTaskIdempotencyKey(...) { /* throw to refuse the call */ },
  },
  after: {
    // listTaskIdempotencyKeys(result, ...) { return result; },
    // getTaskIdempotencyKey(result, ...) { return result; },
  },
};
