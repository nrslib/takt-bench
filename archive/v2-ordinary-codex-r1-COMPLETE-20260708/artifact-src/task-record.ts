import type { TaskRecord } from './types.js';

export function cloneTask(task: TaskRecord): TaskRecord {
  return structuredClone(task);
}
