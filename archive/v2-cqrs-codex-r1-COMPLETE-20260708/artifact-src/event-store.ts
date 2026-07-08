import { ConcurrencyError, type DomainEvent, type EventStore } from './types.js';
import { cloneEvents } from './events.js';

export class InMemoryEventStore implements EventStore {
  private readonly streams = new Map<string, DomainEvent[]>();

  load(streamId: string): { events: DomainEvent[]; version: number } {
    const stored = this.streams.get(streamId);
    if (stored === undefined) {
      return { events: [], version: 0 };
    }

    return { events: cloneEvents(stored), version: stored.length };
  }

  append(streamId: string, events: DomainEvent[], expectedVersion: number): void {
    const stored = this.streams.get(streamId);
    const currentVersion = stored === undefined ? 0 : stored.length;

    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError('Stream version conflict');
    }

    if (stored === undefined) {
      this.streams.set(streamId, cloneEvents(events));
      return;
    }

    this.streams.set(streamId, [...stored, ...cloneEvents(events)]);
  }
}
