import type {
  Command,
  DomainEvent,
  EventStore,
} from './types.js';
import { evolve, decide, initialState } from './domain.js';

export class CommandHandler {
  private store: EventStore;

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
