import type { DomainEvent, StockLevel } from './types.js';

interface StockState {
  onHand: number;
  reserved: number;
  reservations: Map<string, number>;
}

export class StockProjection {
  private stocks: Map<string, StockState> = new Map();

  apply(event: DomainEvent): void {
    if (event.type === 'ProductCreated') {
      this.stocks.set(event.productId, { onHand: 0, reserved: 0, reservations: new Map() });
      return;
    }
    const stock = this.stocks.get(event.productId);
    if (!stock) return;
    if (event.type === 'StockReceived') {
      stock.onHand += event.quantity;
    } else if (event.type === 'StockReserved') {
      stock.reservations.set(event.reservationId, event.quantity);
      stock.reserved += event.quantity;
    } else if (event.type === 'ReservationReleased') {
      const qty = stock.reservations.get(event.reservationId);
      if (qty) {
        stock.reserved -= qty;
        stock.reservations.delete(event.reservationId);
      }
    } else if (event.type === 'StockShipped') {
      const qty = stock.reservations.get(event.reservationId);
      if (qty) {
        stock.onHand -= qty;
        stock.reserved -= qty;
        stock.reservations.delete(event.reservationId);
      }
    }
  }

  getStock(productId: string): StockLevel | undefined {
    const stock = this.stocks.get(productId);
    if (!stock) return undefined;
    const { onHand, reserved } = stock;
    return { onHand, reserved, available: onHand - reserved };
  }

  lowStock(threshold: number): string[] {
    const result: string[] = [];
    for (const [productId, stock] of this.stocks) {
      const available = stock.onHand - stock.reserved;
      if (available < threshold) result.push(productId);
    }
    return result.sort();
  }
}
