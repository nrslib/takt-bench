import type { CreateTaskInput, UpdateTaskInput } from './types.js';
import { ValidationError } from './types.js';

export function validateTitle(title: string): string {
  const normalized = title.trim();
  if (normalized === '') {
    throw new ValidationError('title must not be empty');
  }
  if (normalized.length > 200) {
    throw new ValidationError('title must not exceed 200 characters');
  }
  return normalized;
}

export function validateDescription(description?: string): string {
  return description?.trim() ?? '';
}

export function validateAssignee(assignee?: string): string | undefined {
  if (assignee === undefined) {
    return undefined;
  }
  const normalized = assignee.trim();
  if (normalized === '') {
    throw new ValidationError('assignee must not be empty');
  }
  return normalized;
}

export function validateDueDate(dueDate: Date | null | undefined, now: Date): Date | null | undefined {
  if (dueDate === undefined) {
    return undefined;
  }
  if (dueDate === null) {
    return null;
  }
  if (dueDate < now) {
    throw new ValidationError('dueDate must not be in the past');
  }
  return dueDate;
}

export function normalizeTags(tags?: string[]): string[] {
  if (tags === undefined) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized === '') {
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

export function normalizeCreateInput(input: CreateTaskInput, now: Date) {
  return {
    title: validateTitle(input.title),
    description: validateDescription(input.description),
    priority: input.priority ?? 'medium',
    assignee: validateAssignee(input.assignee),
    tags: normalizeTags(input.tags),
    dueDate: validateDueDate(input.dueDate, now),
  };
}

export function normalizeUpdateInput(input: UpdateTaskInput, now: Date) {
  return {
    title: input.title !== undefined ? validateTitle(input.title) : undefined,
    description: input.description !== undefined ? validateDescription(input.description) : undefined,
    priority: input.priority,
    tags: input.tags !== undefined ? normalizeTags(input.tags) : undefined,
    dueDate: validateDueDate(input.dueDate, now),
  };
}
