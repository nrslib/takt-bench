import type { Command, DomainEvent, EventStore } from './types.js';
import { evolve, initialState, decide } from './domain.js';

export class CommandHandler {
  private store: EventStore;

  constructor(store: EventStore) {
    this.store = store;
  }

  handle(command: Command): DomainEvent[] {
    const streamId = command.productId;
    const { events, version } = this.store.load(streamId);
    const currentState = events.reduce(evolve, initialState);
    const newEvents = decide(currentState, command);
    this.store.append(streamId, newEvents, version);
    return newEvents;
  }
}
