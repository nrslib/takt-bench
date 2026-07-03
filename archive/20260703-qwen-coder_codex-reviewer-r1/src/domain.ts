import type { Command, DomainEvent, ProductState } from './types.js';
import { DomainError } from './types.js';

export const initialState: ProductState = {
  exists: false,
  name: '',
  onHand: 0,
  reservations: {},
};

export function evolve(state: ProductState, event: DomainEvent): ProductState {
  const newState: ProductState = {
    exists: state.exists,
    name: state.name,
    onHand: state.onHand,
    reservations: { ...state.reservations },
  };

  switch (event.type) {
    case 'ProductCreated':
      newState.exists = true;
      newState.name = event.name;
      break;
    case 'StockReceived':
      newState.onHand += event.quantity;
      break;
    case 'StockReserved':
      newState.reservations[event.reservationId] = event.quantity;
      break;
    case 'ReservationReleased':
      delete newState.reservations[event.reservationId];
      break;
    case 'StockShipped':
      const quantity = newState.reservations[event.reservationId]!;
      newState.onHand -= quantity;
      delete newState.reservations[event.reservationId];
      break;
  }

  return newState;
}

export function decide(state: ProductState, command: Command): DomainEvent[] {
  switch (command.type) {
    case 'CreateProduct':
      return decideCreateProduct(state, command);
    case 'ReceiveStock':
      return decideReceiveStock(state, command);
    case 'ReserveStock':
      return decideReserveStock(state, command);
    case 'ReleaseReservation':
      return decideReleaseReservation(state, command);
    case 'ShipStock':
      return decideShipStock(state, command);
    default:
      return assertNever(command);
  }
}

function assertNever(command: never): never {
  throw new Error(`Unreachable code: unexpected command type: ${JSON.stringify(command)}`);
}

function decideCreateProduct(state: ProductState, command: Command): DomainEvent[] {
  const c = command as CreateProduct;
  if (state.exists) {
    throw new DomainError('Product already exists');
  }
  const trimmedName = c.name.trim();
  if (trimmedName.length === 0) {
    throw new DomainError('Product name cannot be empty');
  }
  return [{ type: 'ProductCreated', productId: c.productId, name: trimmedName }];
}

function decideReceiveStock(state: ProductState, command: Command): DomainEvent[] {
  const c = command as ReceiveStock;
  if (!state.exists) {
    throw new DomainError('Product does not exist');
  }
  if (!isValidQuantity(c.quantity)) {
    throw new DomainError('Invalid quantity');
  }
  return [{ type: 'StockReceived', productId: c.productId, quantity: c.quantity }];
}

function decideReserveStock(state: ProductState, command: Command): DomainEvent[] {
  const c = command as ReserveStock;
  if (!state.exists) {
    throw new DomainError('Product does not exist');
  }
  if (!isValidQuantity(c.quantity)) {
    throw new DomainError('Invalid quantity');
  }
  if (c.reservationId in state.reservations) {
    throw new DomainError('Reservation ID already exists');
  }
  const available = state.onHand - getTotalReserved(state);
  if (c.quantity > available) {
    throw new DomainError('Not enough stock available');
  }
  return [{ type: 'StockReserved', productId: c.productId, reservationId: c.reservationId, quantity: c.quantity }];
}

function decideReleaseReservation(state: ProductState, command: Command): DomainEvent[] {
  const c = command as ReleaseReservation;
  if (!(c.reservationId in state.reservations)) {
    throw new DomainError('Reservation does not exist');
  }
  return [{ type: 'ReservationReleased', productId: c.productId, reservationId: c.reservationId }];
}

function decideShipStock(state: ProductState, command: Command): DomainEvent[] {
  const c = command as ShipStock;
  if (!(c.reservationId in state.reservations)) {
    throw new DomainError('Reservation does not exist');
  }
  return [{ type: 'StockShipped', productId: c.productId, reservationId: c.reservationId }];
}

function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0;
}

function getTotalReserved(state: ProductState): number {
  return Object.values(state.reservations).reduce((sum, q) => sum + q, 0);
}

import type { CreateProduct, ReceiveStock, ReserveStock, ReleaseReservation, ShipStock } from './types.js';
