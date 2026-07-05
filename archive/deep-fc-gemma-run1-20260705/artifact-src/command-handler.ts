import type { Command, DomainEvent, EventStore, ProductState } from './types.js';
import { decide, evolve } from './domain.js';

export class CommandHandler {
  private store: EventStore;

  constructor(store: EventStore) {
    this.store = store;
  }

  handle(command: Command): DomainEvent[] {
    const { events: loadedEvents, version: currentVersion } = this.store.load(command.productId);
    let state: ProductState = { exists: false, name: '', onHand: 0, reservations: {} };
    for (const event of loadedEvents) {
      state = evolve(state, event);
    }

    const newEvents = decide(state, command);

    this.store.append(command.productId, newEvents, currentVersion);
    return newEvents;
  }
}
