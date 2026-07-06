import type { TaskRecord } from './types.js';

export function copyTaskRecord(task: TaskRecord): TaskRecord {
  return {
    ...task,
    tags: [...task.tags],
    createdAt: new Date(task.createdAt.getTime()),
    updatedAt: new Date(task.updatedAt.getTime()),
    dueDate: task.dueDate ? new Date(task.dueDate.getTime()) : undefined,
  };
}
