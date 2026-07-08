import type {
  DomainEvent,
  EventStore,
} from './types.js';
import { ConcurrencyError } from './types.js';

export class InMemoryEventStore implements EventStore {
  private store: Map<string, DomainEvent[]> = new Map();
  private versions: Map<string, number> = new Map();

  load(streamId: string): { events: DomainEvent[]; version: number } {
    const events = this.store.get(streamId);
    if (events === undefined) {
      return { events: [], version: 0 };
    }
    return { events: [...events], version: this.versions.get(streamId) ?? 0 };
  }

  append(streamId: string, events: DomainEvent[], expectedVersion: number): void {
    const currentVersion = this.versions.get(streamId) ?? 0;
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError(
        `Expected version ${expectedVersion}, but current version is ${currentVersion}`
      );
    }
    const existing = this.store.get(streamId);
    const updatedEvents = existing ? [...existing, ...events] : [...events];
    this.store.set(streamId, updatedEvents);
    this.versions.set(streamId, currentVersion + events.length);
  }
}
