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
import { cloneTask } from './task-record.js';

const MAX_TITLE_LENGTH = 200;
const DEFAULT_PRIORITY: Priority = 'medium';
const ACTIVE_STATUSES = new Set<TaskStatus>(['todo', 'in_progress']);

const ALLOWED_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ['in_progress', 'cancelled'],
  in_progress: ['done', 'todo', 'cancelled'],
  done: [],
  cancelled: [],
};

const PRIORITY_RANK: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  createTask(input: CreateTaskInput): TaskRecord {
    const title = normalizeTitle(input.title);
    const description = normalizeDescription(input.description);
    const priority = input.priority === undefined ? DEFAULT_PRIORITY : input.priority;
    const assignee = input.assignee === undefined ? undefined : normalizeAssignee(input.assignee);
    const tags = normalizeTags(input.tags);
    const dueDateContext = resolveCreateDueDate(input.dueDate, this.clock);
    const now = resolveCreateTimestamp(dueDateContext, this.clock);
    const id = this.idGenerator.next();
    assertTaskIdAvailable(this.repo, id);

    const task: TaskRecord = {
      id,
      title,
      description,
      priority,
      status: 'todo',
      assignee,
      tags,
      createdAt: now,
      updatedAt: now,
      dueDate: dueDateContext.dueDate,
    };

    this.repo.save(task);
    return this.getTask(task.id);
  }

  getTask(id: string): TaskRecord {
    return cloneTask(findTaskOrThrow(this.repo, id));
  }

  updateTask(id: string, input: UpdateTaskInput): TaskRecord {
    const existing = findTaskOrThrow(this.repo, id);
    assertEditable(existing);

    const title = input.title === undefined ? existing.title : normalizeTitle(input.title);
    const description = input.description === undefined
      ? existing.description
      : normalizeDescription(input.description);
    const priority = input.priority === undefined ? existing.priority : input.priority;
    const tags = input.tags === undefined ? existing.tags : normalizeTags(input.tags);
    validateUpdatedDueDateInput(input.dueDate);
    const now = getValidCurrentTime(this.clock);
    const dueDate = resolveUpdatedDueDate(input.dueDate, existing.dueDate, now);
    const updated: TaskRecord = {
      ...existing,
      title,
      description,
      priority,
      tags,
      dueDate,
      updatedAt: now,
    };

    this.repo.save(updated);
    return this.getTask(id);
  }

  changeStatus(id: string, next: TaskStatus): TaskRecord {
    const existing = findTaskOrThrow(this.repo, id);
    const allowedNextStatuses = ALLOWED_TRANSITIONS[existing.status];
    if (!allowedNextStatuses.includes(next)) {
      throw new InvalidTransitionError(`Cannot change task status from ${existing.status} to ${next}`);
    }

    const now = getValidCurrentTime(this.clock);
    const updated: TaskRecord = {
      ...existing,
      status: next,
      updatedAt: now,
    };

    this.repo.save(updated);
    return this.getTask(id);
  }

  assign(id: string, assignee: string): TaskRecord {
    const existing = findTaskOrThrow(this.repo, id);
    assertEditable(existing);

    const normalizedAssignee = normalizeAssignee(assignee);
    const now = getValidCurrentTime(this.clock);
    const updated: TaskRecord = {
      ...existing,
      assignee: normalizedAssignee,
      updatedAt: now,
    };

    this.repo.save(updated);
    return this.getTask(id);
  }

  unassign(id: string): TaskRecord {
    const existing = findTaskOrThrow(this.repo, id);
    assertEditable(existing);

    const now = getValidCurrentTime(this.clock);
    const updated: TaskRecord = {
      ...existing,
      assignee: undefined,
      updatedAt: now,
    };

    this.repo.save(updated);
    return this.getTask(id);
  }

  listTasks(filter?: TaskFilter): TaskRecord[] {
    validateTaskFilter(filter);
    return this.repo
      .all()
      .map(cloneTask)
      .filter((task) => matchesFilter(task, filter))
      .sort(compareTasks);
  }
}

function findTaskOrThrow(repo: TaskRepository, id: string): TaskRecord {
  const task = repo.findById(id);
  if (task === undefined) {
    throw new NotFoundError(`Task not found: ${id}`);
  }
  return task;
}

function assertTaskIdAvailable(repo: TaskRepository, id: string): void {
  if (repo.findById(id) !== undefined) {
    throw new ValidationError(`Task id already exists: ${id}`);
  }
}

function assertEditable(task: TaskRecord): void {
  if (!isActiveStatus(task.status)) {
    throw new InvalidTransitionError(`Task is not editable: ${task.status}`);
  }
}

function isActiveStatus(status: TaskStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  if (normalized.length === 0) {
    throw new ValidationError('Task title is required');
  }
  if (normalized.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`Task title must be ${MAX_TITLE_LENGTH} characters or less`);
  }
  return normalized;
}

function normalizeDescription(description: string | undefined): string {
  if (description === undefined) {
    return '';
  }
  return description.trim();
}

function normalizeAssignee(assignee: string): string {
  const normalized = assignee.trim();
  if (normalized.length === 0) {
    throw new ValidationError('Task assignee is required');
  }
  return normalized;
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (tags === undefined) {
    return [];
  }

  const seen = new Set<string>();
  const normalizedTags: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    normalizedTags.push(normalized);
  }
  return normalizedTags;
}

interface CreateDueDateContext {
  dueDate: Date | undefined;
  now: Date | undefined;
}

function resolveCreateDueDate(dueDate: Date | undefined, clock: Clock): CreateDueDateContext {
  if (dueDate === undefined) {
    return { dueDate: undefined, now: undefined };
  }
  validateDueDateValue(dueDate);
  const now = getValidCurrentTime(clock);
  validateDueDate(dueDate, now);
  return { dueDate, now };
}

function resolveCreateTimestamp(context: CreateDueDateContext, clock: Clock): Date {
  if (context.now !== undefined) {
    return context.now;
  }
  return getValidCurrentTime(clock);
}

function resolveUpdatedDueDate(
  dueDate: Date | null | undefined,
  existingDueDate: Date | undefined,
  now: Date,
): Date | undefined {
  if (dueDate === undefined) {
    return existingDueDate;
  }
  if (dueDate === null) {
    return undefined;
  }
  validateDueDate(dueDate, now);
  return dueDate;
}

function validateDueDate(dueDate: Date, now: Date): void {
  const dueDateTime = validateDueDateValue(dueDate);
  const nowTime = validateDateValue(now, 'Current time must be valid');
  if (dueDateTime < nowTime) {
    throw new ValidationError('Task due date must not be in the past');
  }
}

function validateUpdatedDueDateInput(dueDate: Date | null | undefined): void {
  if (dueDate !== undefined && dueDate !== null) {
    validateDueDateValue(dueDate);
  }
}

function validateDueDateValue(dueDate: Date): number {
  return validateDateValue(dueDate, 'Task due date must be valid');
}

function getValidCurrentTime(clock: Clock): Date {
  const now = clock.now();
  validateDateValue(now, 'Current time must be valid');
  return now;
}

function validateDateValue(value: Date, message: string): number {
  const time = value.getTime();
  if (!Number.isFinite(time)) {
    throw new ValidationError(message);
  }
  return time;
}

function validateTaskFilter(filter: TaskFilter | undefined): void {
  if (filter?.overdueAsOf !== undefined) {
    validateDateValue(filter.overdueAsOf, 'Task overdueAsOf must be valid');
  }
}

function matchesFilter(task: TaskRecord, filter: TaskFilter | undefined): boolean {
  if (filter === undefined) {
    return true;
  }
  return matchesStatus(task, filter)
    && matchesAssignee(task, filter)
    && matchesTag(task, filter)
    && matchesOverdue(task, filter);
}

function matchesStatus(task: TaskRecord, filter: TaskFilter): boolean {
  if (filter.status === undefined) {
    return true;
  }
  return task.status === filter.status;
}

function matchesAssignee(task: TaskRecord, filter: TaskFilter): boolean {
  if (filter.assignee === undefined) {
    return true;
  }
  return task.assignee === filter.assignee;
}

function matchesTag(task: TaskRecord, filter: TaskFilter): boolean {
  if (filter.tag === undefined) {
    return true;
  }
  const normalizedTag = filter.tag.trim().toLowerCase();
  if (normalizedTag.length === 0) {
    return false;
  }
  return task.tags.includes(normalizedTag);
}

function matchesOverdue(task: TaskRecord, filter: TaskFilter): boolean {
  if (filter.overdueAsOf === undefined) {
    return true;
  }
  return task.dueDate !== undefined
    && task.dueDate.getTime() < filter.overdueAsOf.getTime()
    && isActiveStatus(task.status);
}

function compareTasks(a: TaskRecord, b: TaskRecord): number {
  return compareNumbers(PRIORITY_RANK[a.priority], PRIORITY_RANK[b.priority])
    || compareOptionalDates(a.dueDate, b.dueDate)
    || compareNumbers(a.createdAt.getTime(), b.createdAt.getTime())
    || compareStrings(a.id, b.id);
}

function compareOptionalDates(a: Date | undefined, b: Date | undefined): number {
  if (a === undefined && b === undefined) {
    return 0;
  }
  if (a === undefined) {
    return 1;
  }
  if (b === undefined) {
    return -1;
  }
  return compareNumbers(a.getTime(), b.getTime());
}

function compareNumbers(a: number, b: number): number {
  return a - b;
}

function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
