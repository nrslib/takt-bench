import type { TaskRecord, TaskRepository } from './types.js';
import { cloneTaskRecord } from './task-record.js';

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, TaskRecord>();

  save(task: TaskRecord): void {
    this.tasks.set(task.id, cloneTaskRecord(task));
  }

  findById(id: string): TaskRecord | undefined {
    const task = this.tasks.get(id);
    return task !== undefined ? cloneTaskRecord(task) : undefined;
  }

  delete(id: string): boolean {
    return this.tasks.delete(id);
  }

  all(): TaskRecord[] {
    return Array.from(this.tasks.values()).map(cloneTaskRecord);
  }
}
