import { decide, evolve, initialState } from '../domain/product.js';
import type { Command, DomainEvent, EventStore } from '../types.js';

export class CommandHandler {
  constructor(private readonly store: EventStore) {}

  handle(command: Command): DomainEvent[] {
    const { events, version } = this.store.load(command.productId);
    const state = events.reduce(evolve, initialState);
    const newEvents = decide(state, command);
    this.store.append(command.productId, newEvents, version);
    return newEvents;
  }
}
