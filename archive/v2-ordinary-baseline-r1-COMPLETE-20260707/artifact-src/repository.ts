import type { TaskRecord, TaskRepository } from './types.js';
import { copyTaskRecord } from './task-copy.js';

export class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, TaskRecord>();

  save(task: TaskRecord): void {
    this.tasks.set(task.id, copyTaskRecord(task));
  }

  findById(id: string): TaskRecord | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    return copyTaskRecord(task);
  }

  delete(id: string): boolean {
    return this.tasks.delete(id);
  }

  all(): TaskRecord[] {
    const result: TaskRecord[] = [];
    for (const task of this.tasks.values()) {
      result.push(copyTaskRecord(task));
    }
    return result;
  }
}
