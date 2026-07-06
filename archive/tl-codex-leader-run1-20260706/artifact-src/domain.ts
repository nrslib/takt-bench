import { DomainError } from './types.js';
import type { Command, DomainEvent, ProductState } from './types.js';

export const initialState: ProductState = Object.freeze({
  exists: false,
  name: '',
  onHand: 0,
  reservations: Object.freeze({}),
});

export function evolve(state: ProductState, event: DomainEvent): ProductState {
  if (event.type === 'ProductCreated') {
    return { ...state, exists: true, name: event.name };
  }

  if (event.type === 'StockReceived') {
    return { ...state, onHand: state.onHand + event.quantity };
  }

  if (event.type === 'StockReserved') {
    const newReservations = { ...state.reservations, [event.reservationId]: event.quantity };
    return { ...state, reservations: newReservations };
  }

  if (event.type === 'ReservationReleased') {
    const { [event.reservationId]: _, ...newReservations } = state.reservations;
    return { ...state, reservations: newReservations };
  }

  if (event.type === 'StockShipped') {
    const reservedQty = state.reservations[event.reservationId] ?? 0;
    const newReservations = { ...state.reservations };
    delete newReservations[event.reservationId];
    return {
      ...state,
      onHand: state.onHand - reservedQty,
      reservations: newReservations,
    };
  }

  return state;
}

export function decide(state: ProductState, command: Command): DomainEvent[] {
  if (command.type === 'CreateProduct') {
    if (state.exists) {
      throw new DomainError();
    }
    const trimmed = command.name.trim();
    if (trimmed === '') {
      throw new DomainError();
    }
    return [{ type: 'ProductCreated', productId: command.productId, name: trimmed }];
  }

  if (command.type === 'ReceiveStock') {
    if (!state.exists) {
      throw new DomainError();
    }
    if (command.quantity <= 0 || !Number.isInteger(command.quantity)) {
      throw new DomainError();
    }
    return [{ type: 'StockReceived', productId: command.productId, quantity: command.quantity }];
  }

  if (command.type === 'ReserveStock') {
    if (!state.exists) {
      throw new DomainError();
    }
    if (command.quantity <= 0 || !Number.isInteger(command.quantity)) {
      throw new DomainError();
    }
    if (Object.hasOwn(state.reservations, command.reservationId)) {
      throw new DomainError();
    }
    const totalReserved = Object.values(state.reservations).reduce((sum, q) => sum + q, 0);
    const available = state.onHand - totalReserved;
    if (command.quantity > available) {
      throw new DomainError();
    }
    return [
      { type: 'StockReserved', productId: command.productId, reservationId: command.reservationId, quantity: command.quantity },
    ];
  }

  if (command.type === 'ReleaseReservation') {
    if (!Object.hasOwn(state.reservations, command.reservationId)) {
      throw new DomainError();
    }
    return [{ type: 'ReservationReleased', productId: command.productId, reservationId: command.reservationId }];
  }

  if (command.type === 'ShipStock') {
    if (!Object.hasOwn(state.reservations, command.reservationId)) {
      throw new DomainError();
    }
    return [{ type: 'StockShipped', productId: command.productId, reservationId: command.reservationId }];
  }

  return [];
}
