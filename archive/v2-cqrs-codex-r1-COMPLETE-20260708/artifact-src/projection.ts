import { DomainError, type DomainEvent, type StockLevel } from './types.js';

interface ProductStock {
  onHand: number;
  reservations: ReadonlyMap<string, number>;
}

export class StockProjection {
  private readonly products = new Map<string, ProductStock>();

  apply(event: DomainEvent): void {
    switch (event.type) {
      case 'ProductCreated':
        if (this.products.has(event.productId)) {
          throw new DomainError('Product already exists in projection');
        }
        this.products.set(event.productId, { onHand: 0, reservations: new Map() });
        break;
      case 'StockReceived':
        this.setProduct(event.productId, (product) => ({
          ...product,
          onHand: product.onHand + event.quantity,
        }));
        break;
      case 'StockReserved':
        this.setProduct(event.productId, (product) => ({
          ...product,
          reservations: addReservation(
            product.reservations,
            event.reservationId,
            event.quantity,
          ),
        }));
        break;
      case 'ReservationReleased':
        this.setProduct(event.productId, (product) => ({
          ...product,
          reservations: removeReservation(product.reservations, event.reservationId),
        }));
        break;
      case 'StockShipped':
        this.setProduct(event.productId, (product) => {
          const quantity = getReservationQuantity(product.reservations, event.reservationId);
          return {
            onHand: product.onHand - quantity,
            reservations: removeReservation(product.reservations, event.reservationId),
          };
        });
        break;
    }
  }

  getStock(productId: string): StockLevel | undefined {
    const product = this.products.get(productId);
    if (product === undefined) {
      return undefined;
    }

    return toStockLevel(product);
  }

  lowStock(threshold: number): string[] {
    return Array.from(this.products.entries())
      .filter(([, product]) => toStockLevel(product).available < threshold)
      .map(([productId]) => productId)
      .sort();
  }

  private setProduct(
    productId: string,
    update: (product: ProductStock) => ProductStock,
  ): void {
    this.products.set(productId, update(this.getProduct(productId)));
  }

  private getProduct(productId: string): ProductStock {
    const product = this.products.get(productId);
    if (product === undefined) {
      throw new DomainError('Product does not exist in projection');
    }

    return product;
  }
}

function removeReservation(
  reservations: ReadonlyMap<string, number>,
  reservationId: string,
): ReadonlyMap<string, number> {
  getReservationQuantity(reservations, reservationId);

  const next = new Map(reservations);
  next.delete(reservationId);
  return next;
}

function addReservation(
  reservations: ReadonlyMap<string, number>,
  reservationId: string,
  quantity: number,
): ReadonlyMap<string, number> {
  if (reservations.has(reservationId)) {
    throw new DomainError('Reservation already exists in projection');
  }

  return new Map(reservations).set(reservationId, quantity);
}

function getReservationQuantity(
  reservations: ReadonlyMap<string, number>,
  reservationId: string,
): number {
  const quantity = reservations.get(reservationId);
  if (quantity === undefined) {
    throw new DomainError('Reservation does not exist in projection');
  }

  return quantity;
}

function toStockLevel(product: ProductStock): StockLevel {
  const reserved = Array.from(product.reservations.values())
    .reduce((total, quantity) => total + quantity, 0);

  return {
    onHand: product.onHand,
    reserved,
    available: product.onHand - reserved,
  };
}
