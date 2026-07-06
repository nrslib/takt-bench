import type { Command, DomainEvent, EventStore, ProductState } from '../types.js';
import { evolve, initialState } from './inventory-aggregate.js';
import { decide } from './command-decider.js';

export class CommandHandler {
  private store: EventStore;

  constructor(store: EventStore) {
    this.store = store;
  }

  handle(command: Command): DomainEvent[] {
    const { events: existingEvents } = this.store.load(command.productId);
    const state = existingEvents.reduce(evolve, initialState);
    const events = decide(state, command);
    const currentVersion = existingEvents.length;
    this.store.append(command.productId, events, currentVersion);
    return events;
  }
}
