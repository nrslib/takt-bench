/**
 * 公開 API。仕様は README.md、型の契約は ./types.ts を参照。
 * このファイルの公開シグネチャは変更禁止。内部のモジュール分割は自由
 * （実装を別モジュールに置き、ここから re-export してよい）。
 */
import type {
  Clock,
  CreateTaskInput,
  IdGenerator,
  TaskFilter,
  TaskRecord,
  TaskRepository,
  TaskStatus,
  UpdateTaskInput,
} from './types.js';

export * from './types.js';

export class InMemoryTaskRepository implements TaskRepository {
  save(_task: TaskRecord): void {
    throw new Error('Not implemented');
  }

  findById(_id: string): TaskRecord | undefined {
    throw new Error('Not implemented');
  }

  delete(_id: string): boolean {
    throw new Error('Not implemented');
  }

  all(): TaskRecord[] {
    throw new Error('Not implemented');
  }
}

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  createTask(_input: CreateTaskInput): TaskRecord {
    throw new Error('Not implemented');
  }

  getTask(_id: string): TaskRecord {
    throw new Error('Not implemented');
  }

  updateTask(_id: string, _input: UpdateTaskInput): TaskRecord {
    throw new Error('Not implemented');
  }

  changeStatus(_id: string, _next: TaskStatus): TaskRecord {
    throw new Error('Not implemented');
  }

  assign(_id: string, _assignee: string): TaskRecord {
    throw new Error('Not implemented');
  }

  unassign(_id: string): TaskRecord {
    throw new Error('Not implemented');
  }

  listTasks(_filter?: TaskFilter): TaskRecord[] {
    throw new Error('Not implemented');
  }
}
