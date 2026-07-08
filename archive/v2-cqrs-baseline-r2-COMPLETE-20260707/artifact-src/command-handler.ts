import { decide, evolve, initialState } from './domain.js';
import type { Command, DomainEvent, EventStore } from './types.js';

export class CommandHandler {
  private readonly store: EventStore;

  constructor(store: EventStore) {
    this.store = store;
  }

  handle(command: Command): DomainEvent[] {
    const streamId = command.productId;
    const { events, version } = this.store.load(streamId);
    const state = events.reduce(evolve, initialState);
    const newEvents = decide(state, command);
    this.store.append(streamId, newEvents, version);
    return newEvents;
  }
}
