import type { DomainEvent, ProductState } from '../types.js';

export const initialState: ProductState = Object.freeze({
  exists: false,
  name: '',
  onHand: 0,
  reservations: Object.create(null),
});

export function evolve(state: ProductState, event: DomainEvent): ProductState {
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
      const quantityShipped = shippedReservations[event.reservationId] || 0;
      delete shippedReservations[event.reservationId];
      return {
        ...state,
        onHand: state.onHand - quantityShipped,
        reservations: shippedReservations,
      };
    default:
      return state;
  }
}
