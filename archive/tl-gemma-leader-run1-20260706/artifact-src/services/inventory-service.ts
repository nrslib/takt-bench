import type {
  Command,
  DomainEvent,
  EventStore,
  ProductState,
  StockLevel,
} from '../types.js';
import { CommandHandler } from '../domain/command-handler.js';
import { StockProjection } from '../domain/stock-projection.js';
import { evolve, initialState } from '../domain/inventory-aggregate.js';
import { decide } from '../domain/command-decider.js';

export interface InventoryService {
  handleCommand<T extends Command>(command: T): DomainEvent[];
  getStock(productId: string): StockLevel | undefined;
  lowStock(threshold: number): string[];
}

export class DefaultInventoryService implements InventoryService {
  private readonly store: EventStore;
  private handler: CommandHandler;
  private projection: StockProjection;

  constructor(store: EventStore) {
    this.store = store;
    this.handler = new CommandHandler(store);
    this.projection = new StockProjection();
  }

  handleCommand<T extends Command>(command: T): DomainEvent[] {
    const events = this.handler.handle(command);
    for (const event of events) {
      this.projection.apply(event);
    }
    return events;
  }

  getStock(productId: string): StockLevel | undefined {
    return this.projection.getStock(productId);
  }

  lowStock(threshold: number): string[] {
    return this.projection.lowStock(threshold);
  }
}

export { CommandHandler, StockProjection };
