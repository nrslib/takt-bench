import type { DomainEvent, EventStore } from '../types.js';
import { ConcurrencyError } from '../types.js';

export class InMemoryEventStore implements EventStore {
  private streams: Map<string, DomainEvent[]>;
  private versions: Map<string, number>;

  constructor() {
    this.streams = new Map();
    this.versions = new Map();
  }

  load(streamId: string): { events: DomainEvent[]; version: number } {
    const events = this.streams.get(streamId) || [];
    const version = this.versions.get(streamId) || 0;
    return {
      events: [...events],
      version,
    };
  }

  append(
    streamId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): void {
    const currentVersion = this.versions.get(streamId) || 0;
    if (expectedVersion !== currentVersion) {
      throw new ConcurrencyError();
    }
    const existingEvents = this.streams.get(streamId) || [];
    this.streams.set(streamId, [...existingEvents, ...events]);
    this.versions.set(streamId, currentVersion + events.length);
  }
}
