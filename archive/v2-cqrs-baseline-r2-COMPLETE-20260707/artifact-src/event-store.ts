import { ConcurrencyError } from './types.js';
import type { DomainEvent, EventStore } from './types.js';

export class InMemoryEventStore implements EventStore {
  private readonly store: Map<string, DomainEvent[]>;
  private readonly versions: Map<string, number>;

  constructor() {
    this.store = new Map();
    this.versions = new Map();
  }

  load(streamId: string): { events: DomainEvent[]; version: number } {
    const events = this.store.get(streamId);
    const version = this.versions.get(streamId) ?? 0;
    if (events === undefined) {
      return { events: [], version: 0 };
    }
    return { events: [...events], version };
  }

  append(streamId: string, events: DomainEvent[], expectedVersion: number): void {
    const currentVersion = this.versions.get(streamId) ?? 0;
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError();
    }
    const existing = this.store.get(streamId);
    const newEvents = existing !== undefined ? [...existing, ...events] : [...events];
    this.store.set(streamId, newEvents);
    this.versions.set(streamId, currentVersion + events.length);
  }
}
