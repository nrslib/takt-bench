import { DomainError } from '../types.js';

import type { Command, DomainEvent, ProductState } from '../types.js';

export function decide(state: ProductState, command: Command): DomainEvent[] {
  switch (command.type) {
    case 'CreateProduct':
      if (state.exists) {
        throw new DomainError();
      }
      const name = command.name.trim();
      if (name === '') {
        throw new DomainError();
      }
      return [{ type: 'ProductCreated', productId: command.productId, name }];
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
      const reservedTotal = Object.values(state.reservations).reduce((sum, qty) => sum + qty, 0);
      const available = state.onHand - reservedTotal;
      if (command.quantity <= 0 || !Number.isInteger(command.quantity)) {
        throw new DomainError();
      }
      if (command.quantity > available) {
        throw new DomainError();
      }
      if (Object.hasOwn(state.reservations, command.reservationId)) {
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
