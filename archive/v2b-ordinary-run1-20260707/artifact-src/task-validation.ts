import type { CreateTaskInput, TaskRecord, UpdateTaskInput } from './types.js';
import { ValidationError } from './types.js';

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function normalizePriority(priority?: string): 'low' | 'medium' | 'high' {
  if (!priority) return 'medium';
  if (priority in PRIORITY_ORDER) {
    return priority as 'low' | 'medium' | 'high';
  }
  return 'medium';
}

export function normalizeTags(tags?: string[]): string[] {
  if (!tags || tags.length === 0) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

export function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new ValidationError('Title cannot be empty');
  }
  if (trimmed.length > 200) {
    throw new ValidationError('Title must be 200 characters or fewer');
  }
  return trimmed;
}

export function normalizeDescription(description?: string): string {
  if (!description) return '';
  return description.trim();
}

export function normalizeAssignee(assignee?: string): string {
  if (!assignee) {
    throw new ValidationError('Assignee cannot be empty');
  }
  const trimmed = assignee.trim();
  if (!trimmed) {
    throw new ValidationError('Assignee cannot be empty');
  }
  return trimmed;
}

export function validateDueDate(
  dueDate: Date | null | undefined,
  now: Date,
): Date | undefined {
  if (dueDate === null) return undefined;
  if (!dueDate) return undefined;
  if (dueDate.getTime() < now.getTime()) {
    throw new ValidationError('Due date cannot be in the past');
  }
  return dueDate;
}

export function normalizeCreateTaskInput(
  input: CreateTaskInput,
  now: Date,
): Pick<
  TaskRecord,
  'title' | 'description' | 'priority' | 'assignee' | 'tags' | 'dueDate'
> {
  return {
    title: normalizeTitle(input.title),
    description: normalizeDescription(input.description),
    priority: normalizePriority(input.priority),
    assignee: input.assignee !== undefined ? normalizeAssignee(input.assignee) : undefined,
    tags: normalizeTags(input.tags),
    dueDate: validateDueDate(input.dueDate, now),
  };
}

export function normalizeUpdateTaskInput(
  input: UpdateTaskInput,
  now: Date,
): Partial<
  Pick<
    TaskRecord,
    'title' | 'description' | 'priority' | 'tags' | 'dueDate'
  >
> {
  const result: Partial<
    Pick<
      TaskRecord,
      'title' | 'description' | 'priority' | 'tags' | 'dueDate'
    >
  > = {};
  
  if (input.title !== undefined) {
    result.title = normalizeTitle(input.title);
  }
  
  if (input.description !== undefined) {
    result.description = normalizeDescription(input.description);
  }
  
  if (input.priority !== undefined) {
    result.priority = normalizePriority(input.priority);
  }
  
  if (input.tags !== undefined) {
    result.tags = normalizeTags(input.tags);
  }
  
  if (input.dueDate !== undefined) {
    result.dueDate = validateDueDate(input.dueDate, now);
  }
  
  return result;
}

export function isValidTransition(from: string, to: string): boolean {
  const allowed: Record<string, string[]> = {
    todo: ['in_progress', 'cancelled'],
    in_progress: ['done', 'todo', 'cancelled'],
  };
  return !!allowed[from]?.includes(to);
}
