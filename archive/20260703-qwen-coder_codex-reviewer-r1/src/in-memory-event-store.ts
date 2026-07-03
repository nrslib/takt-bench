import type { DomainEvent, EventStore } from './types.js';
import { ConcurrencyError } from './types.js';

export class InMemoryEventStore implements EventStore {
  private store: Map<string, DomainEvent[]> = new Map();
  private versionMap: Map<string, number> = new Map();

  load(streamId: string): { events: DomainEvent[]; version: number } {
    const events = this.store.get(streamId);
    if (events === undefined) {
      return { events: [], version: 0 };
    }
    return { events: [...events], version: this.versionMap.get(streamId)! };
  }

  append(streamId: string, events: DomainEvent[], expectedVersion: number): void {
    const currentVersion = this.versionMap.get(streamId) ?? 0;
    if (expectedVersion !== currentVersion) {
      throw new ConcurrencyError('Expected version does not match');
    }
    const existingEvents = this.store.get(streamId);
    const newEvents = existingEvents ? [...existingEvents, ...events] : [...events];
    this.store.set(streamId, newEvents);
    this.versionMap.set(streamId, currentVersion + events.length);
  }
}
