import type { Clock, IdGenerator } from '../src/types.js';
import { InMemoryTaskRepository, TaskService } from '../src/index.js';

export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(next: Date): void {
    this.current = next;
  }
}

export class SeqIds implements IdGenerator {
  private n = 0;

  next(): string {
    this.n += 1;
    return `task-${this.n}`;
  }
}

export const T0 = new Date('2026-07-01T00:00:00.000Z');

export function makeService(clock = new FixedClock(T0)): {
  service: TaskService;
  repo: InMemoryTaskRepository;
  clock: FixedClock;
} {
  const repo = new InMemoryTaskRepository();
  const service = new TaskService(repo, clock, new SeqIds());
  return { service, repo, clock };
}
