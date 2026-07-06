/**
 * 検証済み参照実装（採点・テスト検証用。ベンチ対象ではない）。
 */
import {
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
  type Clock,
  type CreateTaskInput,
  type IdGenerator,
  type Priority,
  type TaskFilter,
  type TaskRecord,
  type TaskRepository,
  type TaskStatus,
  type UpdateTaskInput,
} from './types.js';

function copyTask(task: TaskRecord): TaskRecord {
  return {
    ...task,
    tags: [...task.tags],
    createdAt: new Date(task.createdAt.getTime()),
    updatedAt: new Date(task.updatedAt.getTime()),
    dueDate: task.dueDate === undefined ? undefined : new Date(task.dueDate.getTime()),
  };
}

export class InMemoryTaskRepository implements TaskRepository {
  private readonly store = new Map<string, TaskRecord>();

  save(task: TaskRecord): void {
    this.store.set(task.id, copyTask(task));
  }

  findById(id: string): TaskRecord | undefined {
    const found = this.store.get(id);
    return found === undefined ? undefined : copyTask(found);
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  all(): TaskRecord[] {
    return [...this.store.values()].map(copyTask);
  }
}

function validateTitle(raw: string): string {
  const title = raw.trim();
  if (title.length === 0) {
    throw new ValidationError('title must not be empty');
  }
  if (title.length > 200) {
    throw new ValidationError('title must be at most 200 characters');
  }
  return title;
}

function validateAssignee(raw: string): string {
  const assignee = raw.trim();
  if (assignee.length === 0) {
    throw new ValidationError('assignee must not be empty');
  }
  return assignee;
}

function normalizeTags(raw: readonly string[]): string[] {
  const result: string[] = [];
  for (const tag of raw) {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length === 0 || result.includes(normalized)) {
      continue;
    }
    result.push(normalized);
  }
  return result;
}

function validateDueDate(due: Date, now: Date): Date {
  if (due.getTime() < now.getTime()) {
    throw new ValidationError('dueDate must not be in the past');
  }
  return new Date(due.getTime());
}

const ALLOWED_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ['in_progress', 'cancelled'],
  in_progress: ['done', 'todo', 'cancelled'],
  done: [],
  cancelled: [],
};

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

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
      title: validateTitle(input.title),
      description: (input.description ?? '').trim(),
      priority: input.priority ?? 'medium',
      status: 'todo',
      assignee: input.assignee === undefined ? undefined : validateAssignee(input.assignee),
      tags: normalizeTags(input.tags ?? []),
      createdAt: now,
      updatedAt: now,
      dueDate: input.dueDate === undefined ? undefined : validateDueDate(input.dueDate, now),
    };
    this.repo.save(task);
    return copyTask(task);
  }

  getTask(id: string): TaskRecord {
    const task = this.repo.findById(id);
    if (task === undefined) {
      throw new NotFoundError(`task not found: ${id}`);
    }
    return task;
  }

  updateTask(id: string, input: UpdateTaskInput): TaskRecord {
    const task = this.requireEditable(id);
    const now = this.clock.now();
    if (input.title !== undefined) {
      task.title = validateTitle(input.title);
    }
    if (input.description !== undefined) {
      task.description = input.description.trim();
    }
    if (input.priority !== undefined) {
      task.priority = input.priority;
    }
    if (input.tags !== undefined) {
      task.tags = normalizeTags(input.tags);
    }
    if (input.dueDate === null) {
      task.dueDate = undefined;
    } else if (input.dueDate !== undefined) {
      task.dueDate = validateDueDate(input.dueDate, now);
    }
    task.updatedAt = now;
    this.repo.save(task);
    return copyTask(task);
  }

  changeStatus(id: string, next: TaskStatus): TaskRecord {
    const task = this.getTask(id);
    if (!ALLOWED_TRANSITIONS[task.status].includes(next)) {
      throw new InvalidTransitionError(`cannot transition from ${task.status} to ${next}`);
    }
    task.status = next;
    task.updatedAt = this.clock.now();
    this.repo.save(task);
    return copyTask(task);
  }

  assign(id: string, assignee: string): TaskRecord {
    const task = this.requireEditable(id);
    task.assignee = validateAssignee(assignee);
    task.updatedAt = this.clock.now();
    this.repo.save(task);
    return copyTask(task);
  }

  unassign(id: string): TaskRecord {
    const task = this.requireEditable(id);
    task.assignee = undefined;
    task.updatedAt = this.clock.now();
    this.repo.save(task);
    return copyTask(task);
  }

  listTasks(filter?: TaskFilter): TaskRecord[] {
    const normalizedTag = filter?.tag?.trim().toLowerCase();
    return this.repo.all()
      .filter((task) => filter?.status === undefined || task.status === filter.status)
      .filter((task) => filter?.assignee === undefined || task.assignee === filter.assignee)
      .filter((task) => normalizedTag === undefined || task.tags.includes(normalizedTag))
      .filter((task) => {
        if (filter?.overdueAsOf === undefined) {
          return true;
        }
        return task.dueDate !== undefined
          && task.dueDate.getTime() < filter.overdueAsOf.getTime()
          && (task.status === 'todo' || task.status === 'in_progress');
      })
      .sort((a, b) =>
        (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
        || ((a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY) - (b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY))
        || (a.createdAt.getTime() - b.createdAt.getTime())
        || a.id.localeCompare(b.id));
  }

  private requireEditable(id: string): TaskRecord {
    const task = this.getTask(id);
    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(`task is not editable in status ${task.status}`);
    }
    return task;
  }
}
