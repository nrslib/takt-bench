import { DomainError } from '../types.js';
import type { Command, DomainEvent, ProductState } from '../types.js';

export const initialState: ProductState = {
  exists: false,
  name: '',
  onHand: 0,
  reservations: {},
};

function reservedTotal(state: ProductState): number {
  return Object.values(state.reservations).reduce((sum, q) => sum + q, 0);
}

function available(state: ProductState): number {
  return state.onHand - reservedTotal(state);
}

export function evolve(state: ProductState, event: DomainEvent): ProductState {
  switch (event.type) {
    case 'ProductCreated':
      return { ...state, exists: true, name: event.name };
    case 'StockReceived':
      return { ...state, onHand: state.onHand + event.quantity };
    case 'StockReserved':
      return {
        ...state,
        reservations: { ...state.reservations, [event.reservationId]: event.quantity },
      };
    case 'ReservationReleased': {
      const { [event.reservationId]: _released, ...rest } = state.reservations;
      return { ...state, reservations: rest };
    }
    case 'StockShipped': {
      const quantity = state.reservations[event.reservationId] ?? 0;
      const { [event.reservationId]: _shipped, ...rest } = state.reservations;
      return { ...state, onHand: state.onHand - quantity, reservations: rest };
    }
  }
}

function assertExists(state: ProductState): void {
  if (!state.exists) {
    throw new DomainError('Product does not exist');
  }
}

function assertPositiveInteger(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError(`Quantity must be a positive integer: ${quantity}`);
  }
}

function assertReservationExists(state: ProductState, reservationId: string): void {
  if (!(reservationId in state.reservations)) {
    throw new DomainError(`Unknown reservation: ${reservationId}`);
  }
}

export function decide(state: ProductState, command: Command): DomainEvent[] {
  switch (command.type) {
    case 'CreateProduct': {
      if (state.exists) {
        throw new DomainError(`Product already exists: ${command.productId}`);
      }
      if (command.name.trim().length === 0) {
        throw new DomainError('Product name must not be empty');
      }
      return [{ type: 'ProductCreated', productId: command.productId, name: command.name }];
    }
    case 'ReceiveStock': {
      assertExists(state);
      assertPositiveInteger(command.quantity);
      return [{ type: 'StockReceived', productId: command.productId, quantity: command.quantity }];
    }
    case 'ReserveStock': {
      assertExists(state);
      assertPositiveInteger(command.quantity);
      if (command.reservationId in state.reservations) {
        throw new DomainError(`Duplicate reservation: ${command.reservationId}`);
      }
      if (command.quantity > available(state)) {
        throw new DomainError(
          `Insufficient stock: requested ${command.quantity}, available ${available(state)}`,
        );
      }
      return [{
        type: 'StockReserved',
        productId: command.productId,
        reservationId: command.reservationId,
        quantity: command.quantity,
      }];
    }
    case 'ReleaseReservation': {
      assertExists(state);
      assertReservationExists(state, command.reservationId);
      return [{
        type: 'ReservationReleased',
        productId: command.productId,
        reservationId: command.reservationId,
      }];
    }
    case 'ShipStock': {
      assertExists(state);
      assertReservationExists(state, command.reservationId);
      return [{
        type: 'StockShipped',
        productId: command.productId,
        reservationId: command.reservationId,
      }];
    }
  }
}
