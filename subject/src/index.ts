/**
 * 公開 API。仕様は README.md、型の契約は ./types.ts を参照。
 * このファイルの公開シグネチャは変更禁止。内部のモジュール分割は自由
 * （実装を別モジュールに置き、ここから re-export してよい）。
 */
import type {
  Command,
  DomainEvent,
  EventStore,
  ProductState,
  StockLevel,
} from './types.js';

export * from './types.js';

export const initialState: ProductState = {
  exists: false,
  name: '',
  onHand: 0,
  reservations: {},
};

export function evolve(state: ProductState, event: DomainEvent): ProductState {
  throw new Error('Not implemented');
}

export function decide(state: ProductState, command: Command): DomainEvent[] {
  throw new Error('Not implemented');
}

export class InMemoryEventStore implements EventStore {
  load(streamId: string): { events: DomainEvent[]; version: number } {
    throw new Error('Not implemented');
  }

  append(streamId: string, events: DomainEvent[], expectedVersion: number): void {
    throw new Error('Not implemented');
  }
}

export class CommandHandler {
  constructor(store: EventStore) {
    throw new Error('Not implemented');
  }

  handle(command: Command): DomainEvent[] {
    throw new Error('Not implemented');
  }
}

export class StockProjection {
  apply(event: DomainEvent): void {
    throw new Error('Not implemented');
  }

  getStock(productId: string): StockLevel | undefined {
    throw new Error('Not implemented');
  }

  lowStock(threshold: number): string[] {
    throw new Error('Not implemented');
  }
}
