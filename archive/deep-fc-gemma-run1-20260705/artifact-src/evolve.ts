import type { DomainEvent, ProductState } from './types.js';

export function evolve(state: ProductState, event: DomainEvent): ProductState {
  const newState = {
    ...state,
    reservations: { ...state.reservations },
  };

  if (event.type === 'ProductCreated') {
    newState.exists = true;
    newState.name = event.name;
  } else if (event.type === 'StockReceived') {
    newState.onHand += event.quantity;
  } else if (event.type === 'StockReserved') {
    newState.reservations[event.reservationId] = event.quantity;
  } else if (event.type === 'ReservationReleased') {
    delete newState.reservations[event.reservationId];
  } else if (event.type === 'StockShipped') {
    if (Object.hasOwn(state.reservations, event.reservationId)) {
      const reservedQty = state.reservations[event.reservationId] as number;
      newState.onHand -= reservedQty;
    }
    delete newState.reservations[event.reservationId];
  }

  return newState;
}
