import type { Clock, CreateTaskInput, Priority, TaskRecord, UpdateTaskInput } from './types.js';
import { ValidationError } from './types.js';

export function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Title is empty after trimming');
  }
  if (trimmed.length > 200) {
    throw new ValidationError(`Title is too long: ${trimmed.length} characters (max: 200)`);
  }
  return trimmed;
}

export function normalizeDescription(
  description: string | undefined,
): string {
  return description?.trim() ?? '';
}

export function normalizeAssignee(
  assignee: string | undefined,
): string | undefined {
  if (assignee === undefined) {
    return undefined;
  }
  const trimmed = assignee.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Assignee is empty after trimming');
  }
  return trimmed;
}

export function normalizeRequiredAssignee(assignee: string): string {
  const trimmed = assignee.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Assignee is empty after trimming');
  }
  return trimmed;
}

export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length === 0) {
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

export function normalizeTagFilter(tag: string | undefined): string | undefined {
  if (tag === undefined) {
    return undefined;
  }
  const trimmed = tag.trim().toLowerCase();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function validateDueDate(
  dueDate: Date | null | undefined,
  now: Date,
): Date | undefined {
  if (!dueDate) {
    return undefined;
  }
  if (dueDate.getTime() < now.getTime()) {
    throw new ValidationError('dueDate is in the past');
  }
  return dueDate;
}

export function normalizePriority(priority: Priority | undefined): Priority {
  return priority ?? 'medium';
}

export function cloneTask(task: TaskRecord): TaskRecord {
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
    dueDate: task.dueDate ? new Date(task.dueDate.getTime()) : undefined,
  };
}

export function cloneDate(date: Date | undefined): Date | undefined {
  return date ? new Date(date.getTime()) : undefined;
}

export function cloneRequiredDate(date: Date): Date {
  return new Date(date.getTime());
}

export function buildTaskRecord(
  input: CreateTaskInput,
  clock: Clock,
  idGenerator: { next(): string },
): TaskRecord {
  const now = clock.now();
  const title = normalizeTitle(input.title);
  const description = normalizeDescription(input.description);
  const priority = normalizePriority(input.priority);
  const assignee = normalizeAssignee(input.assignee);
  const tags = normalizeTags(input.tags);
  const dueDate = validateDueDate(input.dueDate, now);

  return {
    id: idGenerator.next(),
    title,
    description,
    priority,
    status: 'todo',
    assignee,
    tags,
    createdAt: cloneRequiredDate(now),
    updatedAt: cloneRequiredDate(now),
    dueDate,
  };
}

export function applyUpdateInput(
  existing: TaskRecord,
  input: UpdateTaskInput,
  now: Date,
  validateDueDateImpl: (dueDate: Date | null | undefined) => Date | undefined,
): TaskRecord {
  const title = input.title !== undefined ? normalizeTitle(input.title) : existing.title;
  const description = input.description !== undefined
    ? normalizeDescription(input.description)
    : existing.description;
  const priority = input.priority !== undefined
    ? normalizePriority(input.priority)
    : existing.priority;
  const tags = input.tags !== undefined ? normalizeTags(input.tags) : existing.tags;
  const dueDate =
    input.dueDate !== undefined
      ? validateDueDateImpl(input.dueDate)
      : existing.dueDate;

  return {
    ...existing,
    title,
    description,
    priority,
    tags,
    dueDate,
    updatedAt: cloneRequiredDate(now),
  };
}
