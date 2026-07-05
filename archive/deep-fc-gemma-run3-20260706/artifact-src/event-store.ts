import type { DomainEvent, EventStore } from './types.js';
import { ConcurrencyError } from './types.js';

export class InMemoryEventStore implements EventStore {
  private stores: Map<string, DomainEvent[]> = new Map();
  private versions: Map<string, number> = new Map();

  load(streamId: string): { events: DomainEvent[]; version: number } {
    const events = this.stores.get(streamId) ?? [];
    const version = this.versions.get(streamId) ?? 0;
    return {
      events: [...events],
      version,
    };
  }

  append(streamId: string, events: DomainEvent[], expectedVersion: number): void {
    const currentVersion = this.versions.get(streamId) ?? 0;
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError();
    }
    const existing = this.stores.get(streamId) ?? [];
    this.stores.set(streamId, [...existing, ...events]);
    this.versions.set(streamId, currentVersion + events.length);
  }
}
