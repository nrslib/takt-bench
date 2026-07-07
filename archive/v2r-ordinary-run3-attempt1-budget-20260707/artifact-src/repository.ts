import { cloneTask } from './validation.js';
import type { TaskRecord, TaskRepository } from './types.js';

/**
 * インメモリの TaskRepository 実装。
 * Map<string, TaskRecord> を内部状態として持ち、
 * save/findById/all/delete を実装する。
 *
 * 防御的コピー:
 * - save 時: 引数 task の deep copy を保存する
 * - findById/all 時: 返り値として deep copy を返す
 * - tags 配列と Date もコピーする
 */
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
