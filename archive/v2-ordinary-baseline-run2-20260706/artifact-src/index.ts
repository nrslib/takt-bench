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
  Priority,
} from './types.js';
import { ValidationError, NotFoundError, InvalidTransitionError } from './types.js';
import { validateCreateTask, validateUpdateTask, normalizeTags, trimAssignee } from './validation.js';

function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

function deepCopy<T>(value: T): T {
  if (value instanceof Date) {
    return cloneDate(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepCopy(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const copied: Record<string, unknown> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        copied[key] = deepCopy(value[key as keyof T]);
      }
    }
    return copied as T;
  }
  return value;
}

export class InMemoryTaskRepository implements TaskRepository {
  private readonly store: Map<string, TaskRecord> = new Map();

  save(task: TaskRecord): void {
    const copied = deepCopy(task);
    this.store.set(task.id, copied);
  }

  findById(id: string): TaskRecord | undefined {
    const task = this.store.get(id);
    return task ? deepCopy(task) : undefined;
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  all(): TaskRecord[] {
    const result: TaskRecord[] = [];
    for (const task of this.store.values()) {
      result.push(deepCopy(task));
    }
    return result;
  }
}

function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  const transitions: Record<TaskStatus, TaskStatus[]> = {
    todo: ['in_progress', 'cancelled'],
    in_progress: ['done', 'todo', 'cancelled'],
    done: [],
    cancelled: [],
  };
  return transitions[from].includes(to);
}

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  createTask(input: CreateTaskInput): TaskRecord {
    const validated = validateCreateTask(input, this.clock);

    const priority = input.priority ?? 'medium';
    const tags = normalizeTags(input.tags);

    const task: TaskRecord = {
      id: this.idGenerator.next(),
      title: validated.title,
      description: validated.description,
      priority,
      status: 'todo',
      assignee: validated.assignee,
      tags,
      dueDate: validated.dueDate,
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    };

    this.repo.save(task);
    return deepCopy(task);
  }

  getTask(id: string): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`task not found: ${id}`);
    }
    return deepCopy(task);
  }

  updateTask(id: string, input: UpdateTaskInput): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`task not found: ${id}`);
    }

    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(`task is not updateable: status=${task.status}`);
    }

    const validated = validateUpdateTask(input, this.clock);

    const dueDate =
      input.dueDate === null
        ? undefined
        : input.dueDate !== undefined
        ? input.dueDate
        : task.dueDate;

    const updated: TaskRecord = {
      ...deepCopy(task),
      title: validated.title !== undefined ? validated.title : task.title,
      description: validated.description !== undefined ? validated.description : task.description,
      priority: input.priority ?? task.priority,
      tags: input.tags !== undefined ? normalizeTags(input.tags) : task.tags,
      dueDate,
      updatedAt: this.clock.now(),
    };

    this.repo.save(updated);
    return deepCopy(updated);
  }

  changeStatus(id: string, next: TaskStatus): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`task not found: ${id}`);
    }

    if (!isValidTransition(task.status, next)) {
      throw new InvalidTransitionError(`invalid transition: ${task.status} -> ${next}`);
    }

    const updated: TaskRecord = {
      ...deepCopy(task),
      status: next,
      updatedAt: this.clock.now(),
    };

    this.repo.save(updated);
    return deepCopy(updated);
  }

  assign(id: string, assignee: string): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`task not found: ${id}`);
    }

    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(`task is not assignable: status=${task.status}`);
    }

    const trimmedAssignee = trimAssignee(assignee);

    const updated: TaskRecord = {
      ...deepCopy(task),
      assignee: trimmedAssignee,
      updatedAt: this.clock.now(),
    };

    this.repo.save(updated);
    return deepCopy(updated);
  }

  unassign(id: string): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`task not found: ${id}`);
    }

    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(`task is not unassignable: status=${task.status}`);
    }

    const updated: TaskRecord = {
      ...deepCopy(task),
      assignee: undefined,
      updatedAt: this.clock.now(),
    };

    this.repo.save(updated);
    return deepCopy(updated);
  }

  listTasks(filter?: TaskFilter): TaskRecord[] {
    const all = this.repo.all();
    const filtered = all.filter((task) => {
      if (filter?.status !== undefined && task.status !== filter.status) {
        return false;
      }
      if (filter?.assignee !== undefined && task.assignee !== filter.assignee) {
        return false;
      }
      if (filter?.tag !== undefined) {
        const normalizedTag = filter.tag.trim().toLowerCase();
        if (!task.tags.includes(normalizedTag)) {
          return false;
        }
      }
      if (filter?.overdueAsOf !== undefined) {
        if (
          task.dueDate === undefined ||
          task.dueDate >= filter.overdueAsOf ||
          (task.status !== 'todo' && task.status !== 'in_progress')
        ) {
          return false;
        }
      }
      return true;
    });

    const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

    filtered.sort((a, b) => {
      const priDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priDiff !== 0) return priDiff;

      if (a.dueDate && b.dueDate) {
        const dateDiff = a.dueDate.getTime() - b.dueDate.getTime();
        if (dateDiff !== 0) return dateDiff;
      } else if (a.dueDate) {
        return -1;
      } else if (b.dueDate) {
        return 1;
      }

      const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtDiff !== 0) return createdAtDiff;

      return a.id.localeCompare(b.id);
    });

    return filtered;
  }
}
