import type { DomainEvent, StockLevel } from './types.js';

interface ProjectionState {
  onHand: number;
  reservations: Map<string, number>;
}

export class StockProjection {
  private states: Map<string, ProjectionState>;

  constructor() {
    this.states = new Map();
  }

  apply(event: DomainEvent): void {
    switch (event.type) {
      case 'ProductCreated': {
        if (!this.states.has(event.productId)) {
          this.states.set(event.productId, { onHand: 0, reservations: new Map() });
        }
        break;
      }

      case 'StockReceived': {
        const state = this.states.get(event.productId);
        if (!state) {
          throw new Error(`StockReceived for unknown productId: ${event.productId}`);
        }
        this.states.set(event.productId, {
          ...state,
          onHand: state.onHand + event.quantity,
        });
        break;
      }

      case 'StockReserved': {
        const state = this.states.get(event.productId);
        if (!state) {
          throw new Error(`StockReserved for unknown productId: ${event.productId}`);
        }
        const reservations = new Map(state.reservations);
        reservations.set(event.reservationId, event.quantity);
        this.states.set(event.productId, {
          ...state,
          reservations,
        });
        break;
      }

      case 'ReservationReleased': {
        const state = this.states.get(event.productId);
        if (!state) {
          throw new Error(`ReservationReleased for unknown productId: ${event.productId}`);
        }
        if (!state.reservations.has(event.reservationId)) {
          return;
        }
        const reservations = new Map(state.reservations);
        reservations.delete(event.reservationId);
        this.states.set(event.productId, {
          ...state,
          reservations,
        });
        break;
      }

      case 'StockShipped': {
        const state = this.states.get(event.productId);
        if (!state) {
          throw new Error(`StockShipped for unknown productId: ${event.productId}`);
        }
        const reservedQuantity = state.reservations.get(event.reservationId);
        if (reservedQuantity === undefined) {
          throw new Error(`Reservation does not exist for StockShipped: ${event.reservationId}`);
        }
        const reservations = new Map(state.reservations);
        reservations.delete(event.reservationId);
        this.states.set(event.productId, {
          ...state,
          onHand: state.onHand - reservedQuantity,
          reservations,
        });
        break;
      }
    }
  }

  getStock(productId: string): StockLevel | undefined {
    const state = this.states.get(productId);
    if (!state) {
      return undefined;
    }
    const reserved = Array.from(state.reservations.values()).reduce((sum, q) => sum + q, 0);
    const available = state.onHand - reserved;
    return {
      onHand: state.onHand,
      reserved,
      available,
    };
  }

  lowStock(threshold: number): string[] {
    const result: string[] = [];
    for (const [productId, state] of this.states.entries()) {
      const reserved = Array.from(state.reservations.values()).reduce((sum, q) => sum + q, 0);
      const available = state.onHand - reserved;
      if (available < threshold) {
        result.push(productId);
      }
    }
    return result.sort();
  }
}
