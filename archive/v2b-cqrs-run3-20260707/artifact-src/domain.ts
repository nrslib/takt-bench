import type { Command, DomainEvent, ProductState } from './types.js';
import { DomainError } from './types.js';

function hasReservation(reservations: Record<string, number>, reservationId: string): boolean {
  return Object.hasOwn(reservations, reservationId);
}

function getReservationQuantity(reservations: Record<string, number>, reservationId: string): number | undefined {
  if (Object.hasOwn(reservations, reservationId)) {
    return reservations[reservationId];
  }
  return undefined;
}

function copyReservations(reservations: Record<string, number>): Record<string, number> {
  return Object.assign(Object.create(null), reservations);
}

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
        onHand: 0,
        reservations: {},
      };

    case 'StockReceived':
      return {
        ...state,
        onHand: state.onHand + event.quantity,
      };

    case 'StockReserved': {
      const reservations = copyReservations(state.reservations);
      reservations[event.reservationId] = event.quantity;
      return {
        ...state,
        reservations,
      };
    }

    case 'ReservationReleased': {
      if (!hasReservation(state.reservations, event.reservationId)) {
        return state;
      }
      const reservations = copyReservations(state.reservations);
      delete reservations[event.reservationId];
      return {
        ...state,
        reservations,
      };
    }

    case 'StockShipped': {
      const reservedQuantity = getReservationQuantity(state.reservations, event.reservationId);
      if (reservedQuantity === undefined) {
        return state;
      }
      const reservations = copyReservations(state.reservations);
      delete reservations[event.reservationId];
      return {
        ...state,
        onHand: state.onHand - reservedQuantity,
        reservations,
      };
    }

    default:
      return state;
  }
}

export function decide(state: ProductState, command: Command): DomainEvent[] {
  switch (command.type) {
    case 'CreateProduct': {
      if (state.exists) {
        throw new DomainError();
      }
      const trimmedName = command.name.trim();
      if (trimmedName === '') {
        throw new DomainError();
      }
      return [{
        type: 'ProductCreated',
        productId: command.productId,
        name: trimmedName,
      }];
    }

    case 'ReceiveStock': {
      if (!state.exists) {
        throw new DomainError();
      }
      if (!Number.isInteger(command.quantity) || command.quantity <= 0) {
        throw new DomainError();
      }
      return [{
        type: 'StockReceived',
        productId: command.productId,
        quantity: command.quantity,
      }];
    }

    case 'ReserveStock': {
      if (!state.exists) {
        throw new DomainError();
      }
      if (!Number.isInteger(command.quantity) || command.quantity <= 0) {
        throw new DomainError();
      }
      if (hasReservation(state.reservations, command.reservationId)) {
        throw new DomainError();
      }
      const reservedSum = Object.values(state.reservations).reduce((sum, q) => sum + q, 0);
      const available = state.onHand - reservedSum;
      if (command.quantity > available) {
        throw new DomainError();
      }
      return [{
        type: 'StockReserved',
        productId: command.productId,
        reservationId: command.reservationId,
        quantity: command.quantity,
      }];
    }

    case 'ReleaseReservation': {
      if (!hasReservation(state.reservations, command.reservationId)) {
        throw new DomainError();
      }
      return [{
        type: 'ReservationReleased',
        productId: command.productId,
        reservationId: command.reservationId,
      }];
    }

    case 'ShipStock': {
      if (!hasReservation(state.reservations, command.reservationId)) {
        throw new DomainError();
      }
      return [{
        type: 'StockShipped',
        productId: command.productId,
        reservationId: command.reservationId,
      }];
    }
  }
}
