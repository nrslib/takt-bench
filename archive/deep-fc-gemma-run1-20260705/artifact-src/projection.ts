import type { DomainEvent, StockLevel } from './types.js';

export class StockProjection {
  private stockMap: Map<string, { onHand: number; reserved: number }> = new Map();

  apply(event: DomainEvent): void {
    if (event.type === 'ProductCreated') {
      this.stockMap.set(event.productId, { onHand: 0, reserved: 0 });
    } else if (event.type === 'StockReceived') {
      this.updateStock(event.productId, (s) => ({ ...s, onHand: s.onHand + event.quantity }));
    } else if (event.type === 'StockReserved') {
      this.updateStock(event.productId, (s) => ({ onHand: s.onHand, reserved: s.reserved + event.quantity }));
    } else if (event.type === 'ReservationReleased') {
      this.updateStock(event.productId, (s) => ({ onHand: s.onHand, reserved: s.reserved - (this.stockMap.get(event.productId)?.reserved ?? 0) }));
    } else if (event.type === 'StockShipped') {
      const product = this.stockMap.get(event.productId);
      if (product) {
        const reservedQty = product.reserved;
        this.stockMap.set(event.productId, { onHand: product.onHand - reservedQty, reserved: 0 });
      }
    }
  }

  private updateStock(productId: string, updateFn: (stock: { onHand: number; reserved: number }) => { onHand: number; reserved: number }): void {
    const current = this.stockMap.get(productId);
    if (current) {
      this.stockMap.set(productId, updateFn(current));
    }
  }

  getStock(productId: string): StockLevel | undefined {
    const product = this.stockMap.get(productId);
    if (!product) {
      return undefined;
    }
    return {
      onHand: product.onHand,
      reserved: product.reserved,
      available: product.onHand - product.reserved,
    };
  }

  lowStock(threshold: number): string[] {
    const result: string[] = [];
    for (const [productId, product] of this.stockMap.entries()) {
      if (product.onHand - product.reserved < threshold) {
        result.push(productId);
      }
    }
    return result.sort();
  }
}
