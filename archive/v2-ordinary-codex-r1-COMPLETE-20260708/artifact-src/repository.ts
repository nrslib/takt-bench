import type { TaskRecord, TaskRepository } from './types.js';
import { cloneTask } from './task-record.js';

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, TaskRecord>();

  save(task: TaskRecord): void {
    this.tasks.set(task.id, cloneTask(task));
  }

  findById(id: string): TaskRecord | undefined {
    const task = this.tasks.get(id);
    if (task === undefined) {
      return undefined;
    }
    return cloneTask(task);
  }

  delete(id: string): boolean {
    return this.tasks.delete(id);
  }

  all(): TaskRecord[] {
    return Array.from(this.tasks.values(), cloneTask);
  }
}
