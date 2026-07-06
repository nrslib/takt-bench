import type { Command, DomainEvent, EventStore } from './types.js';
import { ConcurrencyError } from './types.js';
import { initialState, decide, evolve } from './domain.js';

interface Stream {
  events: DomainEvent[];
}

export class InMemoryEventStore implements EventStore {
  private streams: Map<string, Stream> = new Map();

  load(streamId: string): { events: DomainEvent[]; version: number } {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return { events: [], version: 0 };
    }
    return { events: [...stream.events], version: stream.events.length };
  }

  append(streamId: string, events: DomainEvent[], expectedVersion: number): void {
    const stream = this.streams.get(streamId);
    const currentVersion = stream ? stream.events.length : 0;
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError();
    }
    if (!stream) {
      this.streams.set(streamId, { events: [...events] });
    } else {
      stream.events.push(...events);
    }
  }
}

export class CommandHandler {
  private store: EventStore;

  constructor(store: EventStore) {
    this.store = store;
  }

  handle(command: Command): DomainEvent[] {
    const { events, version } = this.store.load(command.productId);
    const state = events.reduce(evolve, initialState);
    const newEvents = decide(state, command);
    if (newEvents.length > 0) {
      this.store.append(command.productId, newEvents, version);
    }
    return newEvents;
  }
}
