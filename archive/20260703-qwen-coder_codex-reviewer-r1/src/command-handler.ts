import type { Command, DomainEvent, EventStore } from './types.js';
import { initialState } from './domain.js';
import { evolve, decide } from './domain.js';

export class CommandHandler {
  private readonly store: EventStore;

  constructor(store: EventStore) {
    this.store = store;
  }

  handle(command: Command): DomainEvent[] {
    const { productId } = command;
    const { events: pastEvents, version: currentVersion } = this.store.load(productId);
    let currentState = pastEvents.reduce(evolve, initialState);

    const newEvents = decide(currentState, command);
    if (newEvents.length > 0) {
      this.store.append(productId, newEvents, currentVersion);
    }
    return newEvents;
  }
}
