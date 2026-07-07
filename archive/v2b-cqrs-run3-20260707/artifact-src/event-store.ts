import type { DomainEvent, EventStore } from './types.js';
import { ConcurrencyError } from './types.js';

export class InMemoryEventStore implements EventStore {
  private store: Map<string, DomainEvent[]>;

  constructor() {
    this.store = new Map();
  }

  load(streamId: string): { events: DomainEvent[]; version: number } {
    const events = this.store.get(streamId);
    if (!events) {
      return { events: [], version: 0 };
    }
    return { events: [...events], version: events.length };
  }

  append(streamId: string, events: DomainEvent[], expectedVersion: number): void {
    const current = this.store.get(streamId);
    const currentVersion = current ? current.length : 0;

    if (expectedVersion !== currentVersion) {
      throw new ConcurrencyError();
    }

    const merged = current ? [...current, ...events] : [...events];
    this.store.set(streamId, merged);
  }
}
