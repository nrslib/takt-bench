import type { DomainEvent, StockLevel } from '../types.js';

interface ProductState {
  exists: boolean;
  name: string;
  onHand: number;
  reservations: Record<string, number>;
}

const initialState: ProductState = {
  exists: false,
  name: '',
  onHand: 0,
  reservations: Object.create(null),
};

function evolve(state: ProductState, event: DomainEvent): ProductState {
  switch (event.type) {
    case 'ProductCreated':
      return {
        ...state,
        exists: true,
        name: event.name,
        onHand: 0,
        reservations: Object.create(null),
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
    case 'ReservationReleased':
      const updatedReservations = { ...state.reservations };
      delete updatedReservations[event.reservationId];
      return {
        ...state,
        reservations: updatedReservations,
      };
    case 'StockShipped':
      const shippedReservations = { ...state.reservations };
      const quantityShipped = Object.hasOwn(shippedReservations, event.reservationId) ? shippedReservations[event.reservationId] : 0;
      delete shippedReservations[event.reservationId];
      return {
        ...state,
        onHand: state.onHand - (quantityShipped as number),
        reservations: shippedReservations,
      };
    default:
      return state;
  }
}

export class StockProjection {
  private products: Map<string, ProductState>;

  constructor() {
    this.products = new Map();
  }

  apply(event: DomainEvent): void {
    const productId = event.productId;
    const currentState = this.products.get(productId) || initialState;
    const newState = evolve(currentState, event);
    this.products.set(productId, newState);
  }

  getStock(productId: string): StockLevel | undefined {
    const state = this.products.get(productId);
    if (!state) {
      return undefined;
    }
    const reserved = Object.values(state.reservations).reduce((sum, qty) => sum + qty, 0);
    return {
      onHand: state.onHand,
      reserved,
      available: state.onHand - reserved,
    };
  }

  lowStock(threshold: number): string[] {
    const result: string[] = [];
    for (const [productId, state] of this.products.entries()) {
      const reserved = Object.values(state.reservations).reduce((sum, qty) => sum + qty, 0);
      const available = state.onHand - reserved;
      if (available < threshold) {
        result.push(productId);
      }
    }
    return result.sort();
  }
}
