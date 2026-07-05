/**
 * 公開 API。仕様は README.md、型の契約は ./types.ts を参照。
 * このファイルの公開シグネチャは変更禁止。内部のモジュール分割は自由
 * （実装を別モジュールに置き、ここから re-export してよい）。
 */
import type {
  Command,
  CreateProduct,
  DomainEvent,
  EventStore,
  ProductState,
  ReceiveStock,
  ReserveStock,
  ReleaseReservation,
  ShipStock,
  StockLevel,
} from './types.js';
import { ConcurrencyError, DomainError } from './types.js';

export * from './types.js';

export const initialState: ProductState = Object.freeze({
  exists: false,
  name: '',
  onHand: 0,
  reservations: {},
});

export function evolve(state: ProductState, event: DomainEvent): ProductState {
  switch (event.type) {
    case 'ProductCreated':
      return {
        exists: true,
        name: event.name,
        onHand: 0,
        reservations: {},
      };
    case 'StockReceived':
      return {
        ...state,
        onHand: state.onHand + event.quantity,
      };
    case 'StockReserved':
      return {
        ...state,
        reservations: {
          ...state.reservations,
          [event.reservationId]: event.quantity,
        },
      };
    case 'ReservationReleased': {
      const { [event.reservationId]: _, ...remainingReservations } = state.reservations;
      return {
        ...state,
        reservations: remainingReservations,
      };
    }
    case 'StockShipped': {
      const qty = state.reservations[event.reservationId] || 0;
      const { [event.reservationId]: __, ...remainingReservations2 } = state.reservations;
      return {
        ...state,
        onHand: state.onHand - qty,
        reservations: remainingReservations2,
      };
    }
  }
}

export function decide(state: ProductState, command: Command): DomainEvent[] {
  switch (command.type) {
    case 'CreateProduct':
      return decideCreateProduct(state, command);
    case 'ReceiveStock':
      return decideReceiveStock(state, command);
    case 'ReserveStock':
      return decideReserveStock(state, command);
    case 'ReleaseReservation':
      return decideReleaseReservation(state, command);
    case 'ShipStock':
      return decideShipStock(state, command);
  }
}

function decideCreateProduct(state: ProductState, command: Command): DomainEvent[] {
  if (state.exists) {
    throw new DomainError();
  }
  const createCmd = command as CreateProduct;
  const name = createCmd.name.trim();
  if (name === '') {
    throw new DomainError();
  }
  return [{ type: 'ProductCreated', productId: createCmd.productId, name }];
}

function decideReceiveStock(state: ProductState, command: Command): DomainEvent[] {
  if (!state.exists) {
    throw new DomainError();
  }
  const recvCmd = command as ReceiveStock;
  const quantity = recvCmd.quantity;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError();
  }
  return [{ type: 'StockReceived', productId: recvCmd.productId, quantity }];
}

function decideReserveStock(state: ProductState, command: Command): DomainEvent[] {
  if (!state.exists) {
    throw new DomainError();
  }
  const resvCmd = command as ReserveStock;
  const quantity = resvCmd.quantity;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError();
  }
  const reservedQty = Object.values(state.reservations).reduce((sum, q) => sum + q, 0);
  const available = state.onHand - reservedQty;
  if (quantity > available) {
    throw new DomainError();
  }
  if (state.reservations[resvCmd.reservationId] !== undefined) {
    throw new DomainError();
  }
  return [{ type: 'StockReserved', productId: resvCmd.productId, reservationId: resvCmd.reservationId, quantity }];
}

function decideReleaseReservation(state: ProductState, command: Command): DomainEvent[] {
  if (!state.exists) {
    throw new DomainError();
  }
  const relCmd = command as ReleaseReservation;
  if (state.reservations[relCmd.reservationId] === undefined) {
    throw new DomainError();
  }
  return [{ type: 'ReservationReleased', productId: relCmd.productId, reservationId: relCmd.reservationId }];
}

function decideShipStock(state: ProductState, command: Command): DomainEvent[] {
  if (!state.exists) {
    throw new DomainError();
  }
  const shipCmd = command as ShipStock;
  if (state.reservations[shipCmd.reservationId] === undefined) {
    throw new DomainError();
  }
  return [{ type: 'StockShipped', productId: shipCmd.productId, reservationId: shipCmd.reservationId }];
}

export class InMemoryEventStore implements EventStore {
  private stores: Map<string, DomainEvent[]> = new Map();
  private versions: Map<string, number> = new Map();

  load(streamId: string): { events: DomainEvent[]; version: number } {
    const events = this.stores.get(streamId) || [];
    const version = this.versions.get(streamId) || 0;
    return { events: [...events], version };
  }

  append(streamId: string, events: DomainEvent[], expectedVersion: number): void {
    const currentVersion = this.versions.get(streamId) || 0;
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError();
    }
    const existing = this.stores.get(streamId) || [];
    this.stores.set(streamId, [...existing, ...events]);
    this.versions.set(streamId, currentVersion + events.length);
  }
}

export class CommandHandler {
  private store: EventStore;

  constructor(store: EventStore) {
    this.store = store;
  }

  handle(command: Command): DomainEvent[] {
    const { productId } = command;
    const { events, version } = this.store.load(productId);
    const state = events.reduce(evolve, initialState);
    const newEvents = decide(state, command);
    this.store.append(productId, newEvents, version);
    return newEvents;
  }
}

export class StockProjection {
  private stocks: Map<string, { onHand: number; reserved: number }> = new Map();
  private reservationQuantities: Map<string, number> = new Map();

  apply(event: DomainEvent): void {
    switch (event.type) {
      case 'ProductCreated':
        this.stocks.set(event.productId, {
          onHand: 0,
          reserved: 0,
        });
        break;
      case 'StockReceived': {
        const existing = this.stocks.get(event.productId);
        if (!existing) {
          throw new Error(`StockProjection: product ${event.productId} not found`);
        }
        this.stocks.set(event.productId, {
          onHand: existing.onHand + event.quantity,
          reserved: existing.reserved,
        });
        break;
      }
      case 'StockReserved': {
        const existing = this.stocks.get(event.productId);
        if (!existing) {
          throw new Error(`StockProjection: product ${event.productId} not found`);
        }
        this.stocks.set(event.productId, {
          onHand: existing.onHand,
          reserved: existing.reserved + event.quantity,
        });
        this.reservationQuantities.set(event.reservationId, event.quantity);
        break;
      }
      case 'ReservationReleased': {
        const existing = this.stocks.get(event.productId);
        if (!existing) {
          throw new Error(`StockProjection: product ${event.productId} not found`);
        }
        const qty = this.reservationQuantities.get(event.reservationId) || 0;
        this.stocks.set(event.productId, {
          onHand: existing.onHand,
          reserved: existing.reserved - qty,
        });
        this.reservationQuantities.delete(event.reservationId);
        break;
      }
      case 'StockShipped': {
        const existing = this.stocks.get(event.productId);
        if (!existing) {
          throw new Error(`StockProjection: product ${event.productId} not found`);
        }
        const qty = this.reservationQuantities.get(event.reservationId) || 0;
        this.stocks.set(event.productId, {
          onHand: existing.onHand - qty,
          reserved: existing.reserved - qty,
        });
        this.reservationQuantities.delete(event.reservationId);
        break;
      }
    }
  }

  getStock(productId: string): StockLevel | undefined {
    const stock = this.stocks.get(productId);
    if (!stock) {
      return undefined;
    }
    return {
      onHand: stock.onHand,
      reserved: stock.reserved,
      available: stock.onHand - stock.reserved,
    };
  }

  lowStock(threshold: number): string[] {
    const result: string[] = [];
    for (const [productId, stock] of this.stocks) {
      const available = stock.onHand - stock.reserved;
      if (available < threshold) {
        result.push(productId);
      }
    }
    return result.sort();
  }
}
