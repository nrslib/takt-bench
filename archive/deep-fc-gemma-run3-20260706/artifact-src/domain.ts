import type {
  Command,
  DomainEvent,
  ProductState,
} from './types.js';
import { DomainError } from './types.js';

export const initialState: ProductState = Object.freeze({
  exists: false,
  name: '',
  onHand: 0,
  reservations: Object.freeze({}),
});

export function evolve(state: ProductState, event: DomainEvent): ProductState {
  const newState = { ...state, reservations: { ...state.reservations } };

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
      const reservedQty = newState.reservations[event.reservationId] ?? 0;
      newState.onHand -= reservedQty;
      delete newState.reservations[event.reservationId];
      break;

    default:
      (event as never);
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
      (command as never);
      return [];
  }
}

function decideCreateProduct(
  state: ProductState,
  command: Command & { type: 'CreateProduct' }
): DomainEvent[] {
  if (state.exists) {
    throw new DomainError();
  }
  const name = command.name.trim();
  if (name === '') {
    throw new DomainError();
  }
  return [{ type: 'ProductCreated', productId: command.productId, name }];
}

function decideReceiveStock(
  state: ProductState,
  command: Command & { type: 'ReceiveStock' }
): DomainEvent[] {
  if (!state.exists) {
    throw new DomainError();
  }
  if (!isPositiveInteger(command.quantity)) {
    throw new DomainError();
  }
  return [{ type: 'StockReceived', productId: command.productId, quantity: command.quantity }];
}

function decideReserveStock(
  state: ProductState,
  command: Command & { type: 'ReserveStock' }
): DomainEvent[] {
  if (!state.exists) {
    throw new DomainError();
  }
  if (!isPositiveInteger(command.quantity)) {
    throw new DomainError();
  }
  const available = state.onHand - getReservedTotal(state);
  if (command.quantity > available) {
    throw new DomainError();
  }
  if (Object.hasOwn(state.reservations, command.reservationId)) {
    throw new DomainError();
  }
  return [{ type: 'StockReserved', productId: command.productId, reservationId: command.reservationId, quantity: command.quantity }];
}

function decideReleaseReservation(
  state: ProductState,
  command: Command & { type: 'ReleaseReservation' }
): DomainEvent[] {
  if (!state.exists) {
    throw new DomainError();
  }
  if (!Object.hasOwn(state.reservations, command.reservationId)) {
    throw new DomainError();
  }
  return [{ type: 'ReservationReleased', productId: command.productId, reservationId: command.reservationId }];
}

function decideShipStock(
  state: ProductState,
  command: Command & { type: 'ShipStock' }
): DomainEvent[] {
  if (!state.exists) {
    throw new DomainError();
  }
  if (!Object.hasOwn(state.reservations, command.reservationId)) {
    throw new DomainError();
  }
  return [{ type: 'StockShipped', productId: command.productId, reservationId: command.reservationId }];
}

function isPositiveInteger(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

function getReservedTotal(state: ProductState): number {
  return Object.values(state.reservations).reduce((sum, qty) => sum + qty, 0);
}
