import type { DomainEvent, StockLevel } from './types.js';

export class StockProjection {
  private stocks: Map<string, StockLevel> = new Map();
  private reservationQuantities: Map<string, Map<string, number>> = new Map();

  apply(event: DomainEvent): void {
    switch (event.type) {
      case 'ProductCreated':
        this.stocks.set(event.productId, {
          onHand: 0,
          reserved: 0,
          available: 0,
        });
        this.reservationQuantities.set(event.productId, new Map());
        break;
      case 'StockReceived':
        this.updateStock(event.productId, stock => ({
          onHand: stock.onHand + event.quantity,
          reserved: stock.reserved,
          available: stock.available + event.quantity,
        }));
        break;
      case 'StockReserved':
        this.updateStock(event.productId, stock => ({
          onHand: stock.onHand,
          reserved: stock.reserved + event.quantity,
          available: stock.available - event.quantity,
        }));
        this.trackReservation(event.productId, event.reservationId, event.quantity);
        break;
      case 'ReservationReleased':
        this.updateStock(event.productId, stock => {
          const quantity = this.getReservationQuantity(event.productId, event.reservationId);
          const reserved = stock.reserved - quantity;
          const available = stock.available + quantity;
          return { onHand: stock.onHand, reserved, available };
        });
        this.clearReservation(event.productId, event.reservationId);
        break;
      case 'StockShipped':
        this.updateStock(event.productId, stock => {
          const quantity = this.getReservationQuantity(event.productId, event.reservationId);
          const reserved = stock.reserved - quantity;
          const onHand = stock.onHand - quantity;
          const available = onHand - reserved;
          return { onHand, reserved, available };
        });
        this.clearReservation(event.productId, event.reservationId);
        break;
    }
  }

  getStock(productId: string): StockLevel | undefined {
    return this.stocks.get(productId);
  }

  lowStock(threshold: number): string[] {
    const result: string[] = [];
    for (const [productId, stock] of this.stocks.entries()) {
      if (stock.available < threshold) {
        result.push(productId);
      }
    }
    return result.sort();
  }

  private updateStock(productId: string, updater: (stock: StockLevel) => StockLevel): void {
    const stock = this.stocks.get(productId);
    if (stock !== undefined) {
      this.stocks.set(productId, updater(stock));
    }
  }

  private trackReservation(productId: string, reservationId: string, quantity: number): void {
    const map = this.reservationQuantities.get(productId);
    if (map !== undefined) {
      map.set(reservationId, quantity);
    }
  }

  private getReservationQuantity(productId: string, reservationId: string): number {
    const map = this.reservationQuantities.get(productId);
    const quantity = map?.get(reservationId);
    if (quantity === undefined) {
      throw new Error(`Reservation ${reservationId} not found for product ${productId}`);
    }
    return quantity;
  }

  private clearReservation(productId: string, reservationId: string): void {
    const map = this.reservationQuantities.get(productId);
    map?.delete(reservationId);
  }
}
