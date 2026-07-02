import { ConcurrencyError } from '../types.js';
import type { DomainEvent, EventStore } from '../types.js';

export class InMemoryEventStore implements EventStore {
  private readonly streams = new Map<string, DomainEvent[]>();

  load(streamId: string): { events: DomainEvent[]; version: number } {
    const events = this.streams.get(streamId) ?? [];
    return { events: [...events], version: events.length };
  }

  append(streamId: string, events: DomainEvent[], expectedVersion: number): void {
    const current = this.streams.get(streamId) ?? [];
    if (current.length !== expectedVersion) {
      throw new ConcurrencyError(
        `Version conflict on ${streamId}: expected ${expectedVersion}, actual ${current.length}`,
      );
    }
    this.streams.set(streamId, [...current, ...events]);
  }
}
