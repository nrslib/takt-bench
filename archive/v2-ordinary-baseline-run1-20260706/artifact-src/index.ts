/**
 * 公開 API。仕様は README.md、型の契約は ./types.ts を参照。
 * このファイルの公開シグネチャは変更禁止。内部のモジュール分割は自由
 * （実装を別モジュールに置き、ここから re-export してよい）。
 */
import type {
  Clock,
  CreateTaskInput,
  IdGenerator,
  Priority,
  TaskFilter,
  TaskRecord,
  TaskRepository,
  TaskStatus,
  UpdateTaskInput,
} from './types.js';
import { InvalidTransitionError, NotFoundError, ValidationError } from './types.js';

export * from './types.js';

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks: Map<string, TaskRecord> = new Map();
  private readonly taskOrder: string[] = [];

  save(task: TaskRecord): void {
    const exists = this.tasks.has(task.id);
    this.tasks.set(task.id, cloneTaskRecord(task));
    if (!exists) {
      this.taskOrder.push(task.id);
    }
  }

  findById(id: string): TaskRecord | undefined {
    const task = this.tasks.get(id);
    return task ? cloneTaskRecord(task) : undefined;
  }

  delete(id: string): boolean {
    if (this.tasks.has(id)) {
      this.tasks.delete(id);
      const index = this.taskOrder.indexOf(id);
      this.taskOrder.splice(index, 1);
      return true;
    }
    return false;
  }

  all(): TaskRecord[] {
    return this.taskOrder.map((id) => cloneTaskRecord(this.tasks.get(id)!));
  }
}

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  createTask(input: CreateTaskInput): TaskRecord {
    const normalized = normalizeCreateInput(input);
    validateCreateInput(normalized, this.clock.now());
    const now = this.clock.now();
    const task: TaskRecord = {
      id: this.idGenerator.next(),
      title: normalized.title,
      description: normalized.description ?? '',
      priority: normalized.priority ?? 'medium',
      status: 'todo',
      assignee: normalized.assignee,
      tags: normalized.tags ?? [],
      createdAt: now,
      updatedAt: now,
      dueDate: normalized.dueDate,
    };
    this.repo.save(task);
    return task;
  }

  getTask(id: string): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    return task;
  }

  updateTask(id: string, input: UpdateTaskInput): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot update task with status: ${task.status}`,
      );
    }
    validateUpdateInput(input, this.clock.now());
    const now = this.clock.now();
    const updatedTask: TaskRecord = {
      ...task,
      title: input.title !== undefined ? input.title.trim() : task.title,
      description:
        input.description !== undefined ? input.description.trim() : task.description,
      priority:
        input.priority !== undefined ? input.priority : task.priority,
      tags: input.tags !== undefined ? normalizeTags(input.tags) : task.tags,
      dueDate:
        input.dueDate === null
          ? undefined
          : input.dueDate !== undefined
            ? input.dueDate
            : task.dueDate,
      updatedAt: now,
    };
    this.repo.save(updatedTask);
    return updatedTask;
  }

  changeStatus(id: string, next: TaskStatus): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    if (!isValidStatusTransition(task.status, next)) {
      throw new InvalidTransitionError(
        `Invalid status transition: ${task.status} → ${next}`,
      );
    }
    const now = this.clock.now();
    const updatedTask: TaskRecord = {
      ...task,
      status: next,
      updatedAt: now,
    };
    this.repo.save(updatedTask);
    return updatedTask;
  }

  assign(id: string, assignee: string): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot assign task with status: ${task.status}`,
      );
    }
    const normalizedAssignee = assignee.trim();
    if (normalizedAssignee === '') {
      throw new ValidationError('Assignee cannot be empty');
    }
    const now = this.clock.now();
    const updatedTask: TaskRecord = {
      ...task,
      assignee: normalizedAssignee,
      updatedAt: now,
    };
    this.repo.save(updatedTask);
    return updatedTask;
  }

  unassign(id: string): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot unassign task with status: ${task.status}`,
      );
    }
    const now = this.clock.now();
    const updatedTask: TaskRecord = {
      ...task,
      assignee: undefined,
      updatedAt: now,
    };
    this.repo.save(updatedTask);
    return updatedTask;
  }

  listTasks(filter?: TaskFilter): TaskRecord[] {
    const tasks = this.repo.all();
    let filtered = tasks;

    if (filter?.status !== undefined) {
      filtered = filtered.filter((t) => t.status === filter.status);
    }
    if (filter?.assignee !== undefined) {
      filtered = filtered.filter((t) => t.assignee === filter.assignee);
    }
    if (filter?.tag !== undefined) {
      const normalizedTag = filter.tag.trim().toLowerCase();
      filtered = filtered.filter((t) => t.tags.includes(normalizedTag));
    }
    if (filter && 'overdueAsOf' in filter && filter.overdueAsOf !== undefined) {
      const overdueAsOf = filter.overdueAsOf;
      filtered = filtered.filter(
        (t) =>
          t.dueDate !== undefined &&
          t.dueDate < overdueAsOf &&
          (t.status === 'todo' || t.status === 'in_progress'),
      );
    }

    const priorityOrder: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 };
    filtered.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      const dueDateDiff = compareDueDate(a.dueDate, b.dueDate);
      if (dueDateDiff !== 0) return dueDateDiff;

      const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtDiff !== 0) return createdAtDiff;

      return a.id.localeCompare(b.id);
    });

    return filtered;
  }
}

function normalizeCreateInput(input: CreateTaskInput): CreateTaskInput {
  return {
    title: input.title.trim(),
    description: input.description?.trim(),
    priority: input.priority,
    assignee: input.assignee?.trim(),
    tags: normalizeTags(input.tags ?? []),
    dueDate: input.dueDate,
  };
}

function validateCommonDueDate(dueDate: Date | undefined, now: Date): void {
  if (dueDate !== undefined && dueDate < now) {
    throw new ValidationError('Due date cannot be in the past');
  }
}

function validateCreateInput(input: CreateTaskInput, now: Date): void {
  validateCommonTitle(input.title);
  if (input.assignee !== undefined) {
    validateCommonAssignee(input.assignee);
  }
  validateCommonDueDate(input.dueDate, now);
}

function validateUpdateInput(input: UpdateTaskInput, now: Date): void {
  if (input.title !== undefined) {
    validateCommonTitle(input.title);
  }
  if (input.dueDate !== null && input.dueDate !== undefined) {
    validateCommonDueDate(input.dueDate, now);
  }
}

function validateCommonTitle(title: string): void {
  if (title.trim() === '') {
    throw new ValidationError('Title cannot be empty');
  }
  if (title.trim().length > 200) {
    throw new ValidationError('Title must not exceed 200 characters');
  }
}

function validateCommonAssignee(assignee: string): void {
  if (assignee.trim() === '') {
    throw new ValidationError('Assignee cannot be empty');
  }
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized !== '' && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function isValidStatusTransition(current: TaskStatus, next: TaskStatus): boolean {
  if (current === next) return false;
  if (current === 'todo' && (next === 'in_progress' || next === 'cancelled')) return true;
  if (current === 'in_progress' && (next === 'done' || next === 'todo' || next === 'cancelled')) return true;
  return false;
}

function compareDueDate(a: Date | undefined, b: Date | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a.getTime() - b.getTime();
}

function cloneTaskRecord(task: TaskRecord): TaskRecord {
  return {
    ...task,
    tags: [...task.tags],
    dueDate: task.dueDate ? new Date(task.dueDate.getTime()) : undefined,
    createdAt: new Date(task.createdAt.getTime()),
    updatedAt: new Date(task.updatedAt.getTime()),
  };
}
