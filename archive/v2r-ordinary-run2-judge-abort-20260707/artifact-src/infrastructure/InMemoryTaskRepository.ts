import type { TaskRecord } from '../types.js';
import type { TaskRepository } from '../types.js';

class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, TaskRecord>();

  save(task: TaskRecord): void {
    this.tasks.set(task.id, cloneTask(task));
  }

  findById(id: string): TaskRecord | undefined {
    const task = this.tasks.get(id);
    return task ? cloneTask(task) : undefined;
  }

  delete(id: string): boolean {
    return this.tasks.delete(id);
  }

  all(): TaskRecord[] {
    return Array.from(this.tasks.values()).map(cloneTask);
  }
}

function cloneTask(task: TaskRecord): TaskRecord {
  return {
    ...task,
    tags: [...task.tags],
    createdAt: new Date(task.createdAt.getTime()),
    updatedAt: new Date(task.updatedAt.getTime()),
    dueDate: task.dueDate ? new Date(task.dueDate.getTime()) : undefined,
  };
}

export { InMemoryTaskRepository };
