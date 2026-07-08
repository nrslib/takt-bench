import type { DomainEvent } from './types.js';

export function cloneEvent(event: DomainEvent): DomainEvent {
  switch (event.type) {
    case 'ProductCreated':
      return { ...event };
    case 'StockReceived':
      return { ...event };
    case 'StockReserved':
      return { ...event };
    case 'ReservationReleased':
      return { ...event };
    case 'StockShipped':
      return { ...event };
  }
}

export function cloneEvents(events: DomainEvent[]): DomainEvent[] {
  return events.map(cloneEvent);
}
