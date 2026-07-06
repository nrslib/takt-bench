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
import { NotFoundError, ValidationError, InvalidTransitionError } from './types.js';

export * from './types.js';

function deepCopyTask(task: TaskRecord): TaskRecord {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    assignee: task.assignee,
    tags: [...task.tags],
    createdAt: new Date(task.createdAt.getTime()),
    updatedAt: new Date(task.updatedAt.getTime()),
    dueDate: task.dueDate === null ? undefined : (task.dueDate !== undefined ? new Date(task.dueDate.getTime()) : undefined),
  };
}

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly insertionOrder: string[] = [];

  save(task: TaskRecord): void {
    const taskCopy = deepCopyTask(task);
    const isNew = !this.tasks.has(task.id);
    this.tasks.set(task.id, taskCopy);
    if (isNew) {
      this.insertionOrder.push(task.id);
    }
  }

  findById(id: string): TaskRecord | undefined {
    const task = this.tasks.get(id);
    if (task === undefined) {
      return undefined;
    }
    return deepCopyTask(task);
  }

  delete(id: string): boolean {
    if (!this.tasks.has(id)) {
      return false;
    }
    this.tasks.delete(id);
    const index = this.insertionOrder.indexOf(id);
    if (index !== -1) {
      this.insertionOrder.splice(index, 1);
    }
    return true;
  }

  all(): TaskRecord[] {
    return this.insertionOrder.map((id) => {
      const task = this.tasks.get(id)!;
      return deepCopyTask(task);
    });
  }
}

function isTaskActive(status: TaskStatus): boolean {
  return status === 'todo' || status === 'in_progress';
}

function validateStatusTransition(current: TaskStatus, next: TaskStatus): void {
  const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
    todo: ['in_progress', 'cancelled'],
    in_progress: ['done', 'todo', 'cancelled'],
    done: [],
    cancelled: [],
  };
  const valid = allowedTransitions[current] || [];
  if (valid.includes(next)) {
    return;
  }
  if (current === next) {
    throw new InvalidTransitionError('cannot transition to same status');
  }
  throw new InvalidTransitionError('invalid status transition');
}

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  createTask(input: CreateTaskInput): TaskRecord {
    const now = this.clock.now();
    const task: TaskRecord = {
      id: this.idGenerator.next(),
      title: input.title.trim(),
      description: (input.description ?? '').trim(),
      priority: input.priority ?? 'medium',
      status: 'todo',
      assignee: input.assignee !== undefined ? input.assignee.trim() : undefined,
      tags: input.tags !== undefined ? this.normalizeTags(input.tags) : [],
      createdAt: now,
      updatedAt: now,
      dueDate: input.dueDate,
    };
    this.validateTask(task);
    this.repo.save(task);
    return task;
  }

  getTask(id: string): TaskRecord {
    const task = this.repo.findById(id);
    if (task === undefined) {
      throw new NotFoundError(`task not found: ${id}`);
    }
    return task;
  }

  updateTask(id: string, input: UpdateTaskInput): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`task not found: ${id}`);
    }
    if (!isTaskActive(existing.status)) {
      throw new InvalidTransitionError(`cannot update ${existing.status} task`);
    }
    const now = this.clock.now();
    const updated: TaskRecord = {
      ...existing,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      description: input.description === undefined ? existing.description : input.description.trim(),
      priority: input.priority ?? existing.priority,
      tags: input.tags !== undefined ? this.normalizeTags(input.tags) : existing.tags,
      dueDate: input.dueDate === null ? undefined : (input.dueDate ?? existing.dueDate),
      updatedAt: now,
    };
    this.validateTask(updated);
    this.repo.save(updated);
    return updated;
  }

  changeStatus(id: string, next: TaskStatus): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`task not found: ${id}`);
    }
    validateStatusTransition(existing.status, next);
    const now = this.clock.now();
    const updated: TaskRecord = {
      ...existing,
      status: next,
      updatedAt: now,
    };
    this.repo.save(updated);
    return updated;
  }

  assign(id: string, assignee: string): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`task not found: ${id}`);
    }
    if (!isTaskActive(existing.status)) {
      throw new InvalidTransitionError(`cannot assign to ${existing.status} task`);
    }
    const trimmed = assignee.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('assignee must not be empty');
    }
    const now = this.clock.now();
    const updated: TaskRecord = {
      ...existing,
      assignee: trimmed,
      updatedAt: now,
    };
    this.repo.save(updated);
    return updated;
  }

  unassign(id: string): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`task not found: ${id}`);
    }
    if (!isTaskActive(existing.status)) {
      throw new InvalidTransitionError(`cannot unassign from ${existing.status} task`);
    }
    const now = this.clock.now();
    const updated: TaskRecord = {
      ...existing,
      assignee: undefined,
      updatedAt: now,
    };
    this.repo.save(updated);
    return updated;
  }

  listTasks(filter?: TaskFilter): TaskRecord[] {
    const all = this.repo.all();
    let result = all;

    if (filter !== undefined) {
      if (filter.status !== undefined) {
        result = result.filter((t) => t.status === filter.status);
      }
      if (filter.assignee !== undefined) {
        result = result.filter((t) => t.assignee === filter.assignee);
      }
       if (filter.tag !== undefined) {
        const normalizedTag = this.normalizeTag(filter.tag);
        result = result.filter((t) => t.tags.includes(normalizedTag));
      }
      if (filter.overdueAsOf !== undefined) {
        result = result.filter((t) => {
          if (t.dueDate === undefined) {
            return false;
          }
          if (!isTaskActive(t.status)) {
            return false;
          }
          return t.dueDate.getTime() < filter.overdueAsOf!.getTime();
        });
      }
    }

    result.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      if (a.dueDate !== undefined && b.dueDate !== undefined) {
        const dueDateDiff = a.dueDate.getTime() - b.dueDate.getTime();
        if (dueDateDiff !== 0) {
          return dueDateDiff;
        }
      } else if (a.dueDate !== undefined) {
        return -1;
      } else if (b.dueDate !== undefined) {
        return 1;
      }

      const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return a.id.localeCompare(b.id);
    });

    return result;
  }

  private validateTask(task: TaskRecord): void {
    const title = task.title;
    if (title.length === 0) {
      throw new ValidationError('title is required');
    }
    if (title.length > 200) {
      throw new ValidationError('title must be 200 characters or less');
    }
    if (task.assignee !== undefined && task.assignee.trim().length === 0) {
      throw new ValidationError('assignee must not be empty');
    }
    if (task.dueDate !== undefined && task.dueDate !== null && task.dueDate.getTime() < this.clock.now().getTime()) {
      throw new ValidationError('dueDate must not be in the past');
    }
  }

   private normalizeTags(tags: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const tag of tags) {
      const normalized = tag.trim().toLowerCase();
      if (normalized.length === 0) {
        continue;
      }
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
    }
    return result;
  }

  private normalizeTag(tag: string): string {
    const normalized = tag.trim().toLowerCase();
    return normalized;
  }
}
