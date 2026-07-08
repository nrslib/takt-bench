import type {
  DomainEvent,
  StockLevel,
} from './types.js';

interface StockState {
  onHand: number;
  reservations: Record<string, number>;
}

export class StockProjection {
  private states: Map<string, StockState> = new Map();

  apply(event: DomainEvent): void {
    switch (event.type) {
      case 'ProductCreated':
        this.states.set(event.productId, { onHand: 0, reservations: {} });
        break;

      case 'StockReceived':
        this.updateState(event.productId, state => ({
          onHand: state.onHand + event.quantity,
          reservations: state.reservations,
        }));
        break;

      case 'StockReserved':
        this.updateState(event.productId, state => ({
          onHand: state.onHand,
          reservations: {
            ...state.reservations,
            [event.reservationId]: event.quantity,
          },
        }));
        break;

      case 'ReservationReleased':
        this.updateState(event.productId, state => {
          const { [event.reservationId]: _, ...remaining } = state.reservations;
          return {
            onHand: state.onHand,
            reservations: remaining,
          };
        });
        break;

      case 'StockShipped':
        this.updateState(event.productId, state => {
          const qty = state.reservations[event.reservationId] ?? 0;
          const { [event.reservationId]: _, ...remaining } = state.reservations;
          return {
            onHand: state.onHand - qty,
            reservations: remaining,
          };
        });
        break;

      default:
        break;
    }
  }

  getStock(productId: string): StockLevel | undefined {
    const state = this.states.get(productId);
    if (state === undefined) {
      return undefined;
    }
    const reserved = Object.values(state.reservations).reduce((sum, q) => sum + q, 0);
    return {
      onHand: state.onHand,
      reserved: reserved,
      available: state.onHand - reserved,
    };
  }

  lowStock(threshold: number): string[] {
    const result: string[] = [];
    for (const [productId, state] of this.states.entries()) {
      const reserved = Object.values(state.reservations).reduce((sum, q) => sum + q, 0);
      const available = state.onHand - reserved;
      if (available < threshold) {
        result.push(productId);
      }
    }
    return result.sort();
  }

  private updateState(productId: string, updater: (state: StockState) => StockState): void {
    const existing = this.states.get(productId);
    if (existing !== undefined) {
      this.states.set(productId, updater(existing));
    }
  }
}
