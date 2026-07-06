import type {
  Command,
  DomainEvent,
  ProductState,
} from './types.js';
import { DomainError } from './types.js';

export const initialState: ProductState = {
  exists: false,
  name: '',
  onHand: 0,
  reservations: {},
};

function reservedQuantity(state: ProductState): number {
  return Object.values(state.reservations).reduce((sum, q) => sum + q, 0);
}

function availableQuantity(state: ProductState): number {
  return state.onHand - reservedQuantity(state);
}

function isPositiveInteger(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

export function evolve(state: ProductState, event: DomainEvent): ProductState {
  switch (event.type) {
    case 'ProductCreated':
      return {
        ...state,
        exists: true,
        name: event.name.trim(),
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

    case 'ReservationReleased': {
      const { [event.reservationId]: _, ...remaining } = state.reservations;
      return {
        ...state,
        reservations: remaining,
      };
    }

    case 'StockShipped': {
      const qty = state.reservations[event.reservationId] ?? 0;
      const { [event.reservationId]: _, ...remaining } = state.reservations;
      return {
        ...state,
        onHand: state.onHand - qty,
        reservations: remaining,
      };
    }

    default:
      const _exhaustiveCheck: never = event;
      return _exhaustiveCheck;
  }
}

export function decide(state: ProductState, command: Command): DomainEvent[] {
  switch (command.type) {
    case 'CreateProduct': {
      if (state.exists) {
        throw new DomainError(`Product ${command.productId} already exists`);
      }
      const trimmedName = command.name.trim();
      if (trimmedName === '') {
        throw new DomainError('Product name must not be empty');
      }
      return [{ type: 'ProductCreated', productId: command.productId, name: trimmedName }];
    }

    case 'ReceiveStock': {
      if (!state.exists) {
        throw new DomainError(`Product ${command.productId} does not exist`);
      }
      if (!isPositiveInteger(command.quantity)) {
        throw new DomainError(`Quantity must be a positive integer, got ${command.quantity}`);
      }
      return [{ type: 'StockReceived', productId: command.productId, quantity: command.quantity }];
    }

    case 'ReserveStock': {
      if (!state.exists) {
        throw new DomainError(`Product ${command.productId} does not exist`);
      }
      if (!isPositiveInteger(command.quantity)) {
        throw new DomainError(`Quantity must be a positive integer, got ${command.quantity}`);
      }
      if (Object.hasOwn(state.reservations, command.reservationId)) {
        throw new DomainError(`Reservation ${command.reservationId} already exists`);
      }
      if (availableQuantity(state) < command.quantity) {
        throw new DomainError(`Not enough stock available for reservation ${command.reservationId}`);
      }
      return [{ type: 'StockReserved', productId: command.productId, reservationId: command.reservationId, quantity: command.quantity }];
    }

    case 'ReleaseReservation': {
      if (!Object.hasOwn(state.reservations, command.reservationId)) {
        throw new DomainError(`Reservation ${command.reservationId} does not exist`);
      }
      return [{ type: 'ReservationReleased', productId: command.productId, reservationId: command.reservationId }];
    }

    case 'ShipStock': {
      if (!Object.hasOwn(state.reservations, command.reservationId)) {
        throw new DomainError(`Reservation ${command.reservationId} does not exist`);
      }
      return [{ type: 'StockShipped', productId: command.productId, reservationId: command.reservationId }];
    }

    default:
      const _exhaustiveCheck: never = command;
      return [_exhaustiveCheck];
  }
}
