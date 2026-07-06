import type { Clock, CreateTaskInput, UpdateTaskInput } from './types.js';
import { ValidationError } from './types.js';

function trimTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('title is required');
  }
  if (trimmed.length > 200) {
    throw new ValidationError('title must be 200 characters or less');
  }
  return trimmed;
}

function trimDescription(description?: string): string {
  return (description ?? '').trim();
}

export function trimAssignee(assignee?: string): string | undefined {
  if (assignee === undefined) {
    return undefined;
  }
  const trimmed = assignee.trim();
  if (trimmed === '') {
    throw new ValidationError('assignee cannot be empty');
  }
  return trimmed;
}

export function validateDueDate(dueDate: Date | undefined, clock: Clock): void {
  if (dueDate !== undefined && dueDate.getTime() < clock.now().getTime()) {
    throw new ValidationError('dueDate cannot be in the past');
  }
}

export function validateCreateTask(input: CreateTaskInput, clock: Clock): {
  title: string;
  description: string;
  assignee?: string;
  dueDate?: Date;
} {
  const title = trimTitle(input.title);
  const description = trimDescription(input.description);
  const assignee = trimAssignee(input.assignee);
  validateDueDate(input.dueDate, clock);

  return { title, description, assignee, dueDate: input.dueDate };
}

export function validateUpdateTask(input: UpdateTaskInput, clock: Clock): {
  title?: string;
  description?: string;
  dueDate?: Date | null;
} {
  let title: string | undefined = undefined;
  if (input.title !== undefined) {
    title = trimTitle(input.title);
  }

  const description = input.description !== undefined ? trimDescription(input.description) : undefined;

  if (input.dueDate !== undefined && input.dueDate !== null) {
    validateDueDate(input.dueDate, clock);
  }

  return { title, description, dueDate: input.dueDate };
}

export function normalizeTags(tags?: string[]): string[] {
  return tags
    ?.map((t) => t.trim().toLowerCase())
    .filter((t) => t !== '')
    .filter((v, i, a) => a.indexOf(v) === i) ?? [];
}
