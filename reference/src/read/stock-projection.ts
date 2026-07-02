import type { DomainEvent, StockLevel } from '../types.js';

interface ProductRow {
  onHand: number;
  reservations: Map<string, number>;
}

export class StockProjection {
  private readonly rows = new Map<string, ProductRow>();

  apply(event: DomainEvent): void {
    switch (event.type) {
      case 'ProductCreated':
        this.rows.set(event.productId, { onHand: 0, reservations: new Map() });
        return;
      case 'StockReceived':
        this.row(event.productId).onHand += event.quantity;
        return;
      case 'StockReserved':
        this.row(event.productId).reservations.set(event.reservationId, event.quantity);
        return;
      case 'ReservationReleased':
        this.row(event.productId).reservations.delete(event.reservationId);
        return;
      case 'StockShipped': {
        const row = this.row(event.productId);
        const quantity = row.reservations.get(event.reservationId);
        if (quantity !== undefined) {
          row.onHand -= quantity;
          row.reservations.delete(event.reservationId);
        }
        return;
      }
    }
  }

  getStock(productId: string): StockLevel | undefined {
    const row = this.rows.get(productId);
    if (!row) return undefined;
    const reserved = [...row.reservations.values()].reduce((sum, q) => sum + q, 0);
    return { onHand: row.onHand, reserved, available: row.onHand - reserved };
  }

  lowStock(threshold: number): string[] {
    return [...this.rows.keys()]
      .filter((productId) => {
        const stock = this.getStock(productId);
        return stock !== undefined && stock.available < threshold;
      })
      .sort();
  }

  private row(productId: string): ProductRow {
    const row = this.rows.get(productId);
    if (!row) {
      throw new Error(`Projection saw an event for unknown product: ${productId}`);
    }
    return row;
  }
}
