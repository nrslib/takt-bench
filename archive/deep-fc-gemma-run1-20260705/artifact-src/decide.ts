import type { Command, DomainEvent, ProductState } from './types.js';
import { DomainError } from './types.js';

export function decide(state: ProductState, command: Command): DomainEvent[] {
  if (command.type === 'CreateProduct') {
    if (state.exists) {
      throw new DomainError(`Product ${command.productId} already exists`);
    }
    if (!command.name.trim()) {
      throw new DomainError('Product name must not be empty');
    }
    return [{ type: 'ProductCreated', productId: command.productId, name: command.name.trim() }];
  }

  if (command.type === 'ReceiveStock') {
    if (!state.exists) {
      throw new DomainError(`Product ${command.productId} does not exist`);
    }
    if (!Number.isInteger(command.quantity) || command.quantity <= 0) {
      throw new DomainError('Quantity must be a positive integer');
    }
    return [{ type: 'StockReceived', productId: command.productId, quantity: command.quantity }];
  }

  if (command.type === 'ReserveStock') {
    if (!state.exists) {
      throw new DomainError(`Product ${command.productId} does not exist`);
    }
    if (!Number.isInteger(command.quantity) || command.quantity <= 0) {
      throw new DomainError('Quantity must be a positive integer');
    }
    if (Object.hasOwn(state.reservations, command.reservationId)) {
      throw new DomainError(`Reservation ${command.reservationId} already exists`);
    }
    const reservedQty = Object.values(state.reservations).reduce((sum, qty) => sum + qty, 0);
    if (command.quantity > state.onHand - reservedQty) {
      throw new DomainError('Insufficient available stock');
    }
    return [{ type: 'StockReserved', productId: command.productId, reservationId: command.reservationId, quantity: command.quantity }];
  }

  if (command.type === 'ReleaseReservation') {
    if (!Object.hasOwn(state.reservations, command.reservationId)) {
      throw new DomainError(`Reservation ${command.reservationId} does not exist`);
    }
    return [{ type: 'ReservationReleased', productId: command.productId, reservationId: command.reservationId }];
  }

  if (command.type === 'ShipStock') {
    if (!Object.hasOwn(state.reservations, command.reservationId)) {
      throw new DomainError(`Reservation ${command.reservationId} does not exist`);
    }
    return [{ type: 'StockShipped', productId: command.productId, reservationId: command.reservationId }];
  }

  throw new Error('Unknown command');
}
