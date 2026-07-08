import { createInitialState, decide, evolve } from './domain.js';
import type { Command, DomainEvent, EventStore } from './types.js';

export class CommandHandler {
  constructor(private readonly store: EventStore) {}

  handle(command: Command): DomainEvent[] {
    const stream = this.store.load(command.productId);
    const state = stream.events.reduce(evolve, createInitialState());
    const events = decide(state, command);

    this.store.append(command.productId, events, stream.version);

    return events;
  }
}
