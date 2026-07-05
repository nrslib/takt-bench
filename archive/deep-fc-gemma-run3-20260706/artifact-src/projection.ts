import type { DomainEvent, StockLevel } from './types.js';

export class StockProjection {
  private stockReservations: Map<string, Map<string, number>> = new Map();
  private stocks: Map<string, StockLevel> = new Map();

  apply(event: DomainEvent): void {
    switch (event.type) {
      case 'ProductCreated':
        this.stocks.set(event.productId, { onHand: 0, reserved: 0, available: 0 });
        break;

      case 'StockReceived':
        this.updateStock(event.productId, (s) => ({
          onHand: s.onHand + event.quantity,
          reserved: s.reserved,
          available: s.available + event.quantity,
        }));
        break;

      case 'StockReserved':
        this.updateStock(event.productId, (s) => ({
          onHand: s.onHand,
          reserved: s.reserved + event.quantity,
          available: s.available - event.quantity,
        }));
        this.addReservation(event.productId, event.reservationId, event.quantity);
        break;

      case 'ReservationReleased':
        const releasedQty = this.getReservationQty(event.productId, event.reservationId);
        this.updateStock(event.productId, (s) => ({
          onHand: s.onHand,
          reserved: s.reserved - releasedQty,
          available: s.available + releasedQty,
        }));
        this.removeReservation(event.productId, event.reservationId);
        break;

      case 'StockShipped':
        const shippedQty = this.getReservationQty(event.productId, event.reservationId);
        this.updateStock(event.productId, (s) => ({
          onHand: s.onHand - shippedQty,
          reserved: s.reserved - shippedQty,
          available: s.onHand - s.reserved,
        }));
        this.removeReservation(event.productId, event.reservationId);
        break;

      default:
        (event as never);
    }
  }

  getStock(productId: string): StockLevel | undefined {
    return this.stocks.get(productId);
  }

  lowStock(threshold: number): string[] {
    return Array.from(this.stocks.entries())
      .filter(([, s]) => s.available < threshold)
      .map(([productId]) => productId)
      .sort();
  }

  private updateStock(productId: string, updater: (s: StockLevel) => StockLevel): void {
    const current = this.stocks.get(productId);
    if (current !== undefined) {
      this.stocks.set(productId, updater(current));
    }
  }

  private addReservation(productId: string, reservationId: string, quantity: number): void {
    let reservations = this.stockReservations.get(productId);
    if (reservations === undefined) {
      reservations = new Map();
      this.stockReservations.set(productId, reservations);
    }
    reservations.set(reservationId, quantity);
  }

  private getReservationQty(productId: string, reservationId: string): number {
    const reservations = this.stockReservations.get(productId);
    return reservations?.get(reservationId) ?? 0;
  }

  private removeReservation(productId: string, reservationId: string): void {
    const reservations = this.stockReservations.get(productId);
    if (reservations !== undefined) {
      reservations.delete(reservationId);
      if (reservations.size === 0) {
        this.stockReservations.delete(productId);
      }
    }
  }
}
