import { DomainError, type Command, type DomainEvent, type ProductState } from './types.js';
import {
  addReservation,
  cloneReservations,
  createEmptyReservations,
  getReservationQuantity,
  hasReservation,
  removeReservation,
  reservedQuantity,
} from './reservations.js';

export const initialState: ProductState = freezeState(createInitialState());

export function createInitialState(): ProductState {
  return {
    exists: false,
    name: '',
    onHand: 0,
    reservations: createEmptyReservations(),
  };
}

export function evolve(state: ProductState, event: DomainEvent): ProductState {
  switch (event.type) {
    case 'ProductCreated':
      return {
        exists: true,
        name: event.name,
        onHand: 0,
        reservations: createEmptyReservations(),
      };
    case 'StockReceived':
      return {
        ...state,
        onHand: state.onHand + event.quantity,
        reservations: cloneReservations(state.reservations),
      };
    case 'StockReserved':
      return {
        ...state,
        reservations: addReservation(
          state.reservations,
          event.reservationId,
          event.quantity,
        ),
      };
    case 'ReservationReleased':
      return {
        ...state,
        reservations: removeReservation(state.reservations, event.reservationId),
      };
    case 'StockShipped': {
      const quantity = getReservationQuantity(state.reservations, event.reservationId);
      if (quantity === undefined) {
        return copyState(state);
      }

      return {
        ...state,
        onHand: state.onHand - quantity,
        reservations: removeReservation(state.reservations, event.reservationId),
      };
    }
  }
}

export function decide(state: ProductState, command: Command): DomainEvent[] {
  switch (command.type) {
    case 'CreateProduct': {
      if (state.exists) {
        throw new DomainError('Product already exists');
      }

      const name = command.name.trim();
      if (name.length === 0) {
        throw new DomainError('Product name is required');
      }

      return [{ type: 'ProductCreated', productId: command.productId, name }];
    }
    case 'ReceiveStock':
      ensureProductExists(state);
      ensurePositiveInteger(command.quantity, 'Quantity must be a positive integer');
      return [{
        type: 'StockReceived',
        productId: command.productId,
        quantity: command.quantity,
      }];
    case 'ReserveStock':
      ensureProductExists(state);
      ensurePositiveInteger(command.quantity, 'Quantity must be a positive integer');
      if (hasReservation(state.reservations, command.reservationId)) {
        throw new DomainError('Reservation already exists');
      }
      if (command.quantity > availableQuantity(state)) {
        throw new DomainError('Insufficient available stock');
      }

      return [{
        type: 'StockReserved',
        productId: command.productId,
        reservationId: command.reservationId,
        quantity: command.quantity,
      }];
    case 'ReleaseReservation':
      ensureReservationExists(state, command.reservationId);
      return [{
        type: 'ReservationReleased',
        productId: command.productId,
        reservationId: command.reservationId,
      }];
    case 'ShipStock':
      ensureReservationExists(state, command.reservationId);
      return [{
        type: 'StockShipped',
        productId: command.productId,
        reservationId: command.reservationId,
      }];
  }
}

function copyState(state: ProductState): ProductState {
  return {
    ...state,
    reservations: cloneReservations(state.reservations),
  };
}

function freezeState(state: ProductState): ProductState {
  Object.freeze(state.reservations);
  return Object.freeze(state);
}

function ensureProductExists(state: ProductState): void {
  if (!state.exists) {
    throw new DomainError('Product does not exist');
  }
}

function ensureReservationExists(state: ProductState, reservationId: string): void {
  ensureProductExists(state);

  if (!hasReservation(state.reservations, reservationId)) {
    throw new DomainError('Reservation does not exist');
  }
}

function ensurePositiveInteger(quantity: number, message: string): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError(message);
  }
}

function availableQuantity(state: ProductState): number {
  return state.onHand - reservedQuantity(state.reservations);
}
