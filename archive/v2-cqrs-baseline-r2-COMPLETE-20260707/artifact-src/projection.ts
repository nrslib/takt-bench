import type { DomainEvent, StockLevel } from './types.js';

interface ProjectionState {
  onHand: number;
  reservations: Record<string, number>;
}

export class StockProjection {
  private readonly state: Map<string, ProjectionState>;

  constructor() {
    this.state = new Map();
  }

  apply(event: DomainEvent): void {
    switch (event.type) {
      case 'ProductCreated':
        this.state.set(event.productId, { onHand: 0, reservations: {} });
        break;

      case 'StockReceived':
        this.updateOnHand(event.productId, event.quantity);
        break;

      case 'StockReserved':
        this.addReservation(event.productId, event.reservationId, event.quantity);
        break;

      case 'ReservationReleased':
        this.removeReservation(event.productId, event.reservationId);
        break;

      case 'StockShipped':
        this.shipStock(event.productId, event.reservationId);
        break;
    }
  }

  getStock(productId: string): StockLevel | undefined {
    const s = this.state.get(productId);
    if (s === undefined) {
      return undefined;
    }
    const reserved = Object.values(s.reservations).reduce((sum, qty) => sum + qty, 0);
    const available = s.onHand - reserved;
    return { onHand: s.onHand, reserved, available };
  }

  lowStock(threshold: number): string[] {
    const result: string[] = [];
    for (const [productId, s] of this.state.entries()) {
      const reserved = Object.values(s.reservations).reduce((sum, qty) => sum + qty, 0);
      const available = s.onHand - reserved;
      if (available < threshold) {
        result.push(productId);
      }
    }
    return result.sort();
  }

  private updateOnHand(productId: string, quantity: number): void {
    const s = this.state.get(productId);
    if (s === undefined) {
      return;
    }
    this.state.set(productId, { ...s, onHand: s.onHand + quantity });
  }

  private addReservation(productId: string, reservationId: string, quantity: number): void {
    const s = this.state.get(productId);
    if (s === undefined) {
      return;
    }
    this.state.set(productId, {
      ...s,
      reservations: { ...s.reservations, [reservationId]: quantity },
    });
  }

  private removeReservation(productId: string, reservationId: string): void {
    const s = this.state.get(productId);
    if (s === undefined) {
      return;
    }
    const { [reservationId]: _, ...remaining } = s.reservations;
    this.state.set(productId, { ...s, reservations: remaining });
  }

  private shipStock(productId: string, reservationId: string): void {
    const s = this.state.get(productId);
    if (s === undefined) {
      return;
    }
    const quantity = Object.hasOwn(s.reservations, reservationId) ? (s.reservations[reservationId] as number) : 0;
    const { [reservationId]: __, ...remaining } = s.reservations;
    this.state.set(productId, {
      ...s,
      onHand: s.onHand - quantity,
      reservations: remaining,
    });
  }
}
