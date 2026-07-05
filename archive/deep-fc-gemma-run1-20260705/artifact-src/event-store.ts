import type { DomainEvent, EventStore } from './types.js';
import { ConcurrencyError } from './types.js';

export class InMemoryEventStore implements EventStore {
  private streams: Map<string, { events: DomainEvent[]; version: number }> = new Map();

  load(streamId: string): { events: DomainEvent[]; version: number } {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return { events: [], version: 0 };
    }
    return { events: [...stream.events], version: stream.version };
  }

  append(streamId: string, events: DomainEvent[], expectedVersion: number): void {
    const stream = this.streams.get(streamId);
    const currentVersion = stream ? stream.version : 0;

    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError();
    }

    const newVersion = currentVersion + events.length;
    this.streams.set(streamId, {
      events: [...(stream?.events || []), ...events],
      version: newVersion,
    });
  }
}
