import { cloneTask } from './validation.js';
import type { TaskRecord, TaskRepository } from './types.js';

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, TaskRecord>();

  save(task: TaskRecord): void {
    this.tasks.set(task.id, cloneTask(task));
  }

  findById(id: string): TaskRecord | undefined {
    const existing = this.tasks.get(id);
    return existing ? cloneTask(existing) : undefined;
  }

  delete(id: string): boolean {
    return this.tasks.delete(id);
  }

  all(): TaskRecord[] {
    const result: TaskRecord[] = [];
    for (const task of this.tasks.values()) {
      result.push(cloneTask(task));
    }
    return result;
  }
}
