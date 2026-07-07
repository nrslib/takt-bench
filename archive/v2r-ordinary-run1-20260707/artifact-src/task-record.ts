import type { TaskRecord } from './types.js';

export function cloneTaskRecord(task: TaskRecord): TaskRecord {
  const clone: TaskRecord = {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    assignee: task.assignee,
    tags: [...task.tags],
    createdAt: new Date(task.createdAt.getTime()),
    updatedAt: new Date(task.updatedAt.getTime()),
    dueDate: task.dueDate === undefined || task.dueDate === null ? task.dueDate : new Date(task.dueDate.getTime()),
  };
  return clone;
}
