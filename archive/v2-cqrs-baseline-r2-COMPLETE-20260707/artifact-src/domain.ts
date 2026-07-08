import { DomainError } from './types.js';
import type { Command, DomainEvent, ProductState } from './types.js';

export const initialState: ProductState = {
  exists: false,
  name: '',
  onHand: 0,
  reservations: {},
};

export function evolve(state: ProductState, event: DomainEvent): ProductState {
  switch (event.type) {
    case 'ProductCreated':
      return {
        ...state,
        exists: true,
        name: event.name,
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
      const { [event.reservationId]: _, ...remaining } = state.reservations;
      return {
        ...state,
        reservations: remaining,
      };
    case 'StockShipped':
      const shippedQty = Object.hasOwn(state.reservations, event.reservationId) ? (state.reservations[event.reservationId] as number) : 0;
      const { [event.reservationId]: __, ...remaining2 } = state.reservations;
      return {
        ...state,
        onHand: state.onHand - shippedQty,
        reservations: remaining2,
      };
    default:
      return state;
  }
}

export function decide(state: ProductState, command: Command): DomainEvent[] {
  switch (command.type) {
    case 'CreateProduct':
      if (state.exists) {
        throw new DomainError();
      }
      if (command.name.trim() === '') {
        throw new DomainError();
      }
      return [{ type: 'ProductCreated', productId: command.productId, name: command.name.trim() }];

    case 'ReceiveStock':
      if (!state.exists) {
        throw new DomainError();
      }
      if (!Number.isInteger(command.quantity) || command.quantity <= 0) {
        throw new DomainError();
      }
      return [{ type: 'StockReceived', productId: command.productId, quantity: command.quantity }];

    case 'ReserveStock':
      if (!state.exists) {
        throw new DomainError();
      }
      const reservedSum = Object.values(state.reservations).reduce((sum, qty) => sum + qty, 0);
      const available = state.onHand - reservedSum;
      if (command.quantity > available) {
        throw new DomainError();
      }
      if (Object.hasOwn(state.reservations, command.reservationId)) {
        throw new DomainError();
      }
      if (!Number.isInteger(command.quantity) || command.quantity <= 0) {
        throw new DomainError();
      }
      return [{ type: 'StockReserved', productId: command.productId, reservationId: command.reservationId, quantity: command.quantity }];

    case 'ReleaseReservation':
      if (!Object.hasOwn(state.reservations, command.reservationId)) {
        throw new DomainError();
      }
      return [{ type: 'ReservationReleased', productId: command.productId, reservationId: command.reservationId }];

    case 'ShipStock':
      if (!Object.hasOwn(state.reservations, command.reservationId)) {
        throw new DomainError();
      }
      return [{ type: 'StockShipped', productId: command.productId, reservationId: command.reservationId }];

    default:
      return [];
  }
}
