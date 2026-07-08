export function createEmptyReservations(): Record<string, number> {
  return Object.create(null) as Record<string, number>;
}

export function cloneReservations(
  reservations: Record<string, number>,
): Record<string, number> {
  return Object.assign(createEmptyReservations(), reservations);
}

export function addReservation(
  reservations: Record<string, number>,
  reservationId: string,
  quantity: number,
): Record<string, number> {
  return Object.assign(cloneReservations(reservations), { [reservationId]: quantity });
}

export function removeReservation(
  reservations: Record<string, number>,
  reservationId: string,
): Record<string, number> {
  return Object.assign(
    createEmptyReservations(),
    Object.fromEntries(
      Object.entries(reservations).filter(([id]) => id !== reservationId),
    ),
  );
}

export function hasReservation(
  reservations: Record<string, number>,
  reservationId: string,
): boolean {
  return Object.hasOwn(reservations, reservationId);
}

export function getReservationQuantity(
  reservations: Record<string, number>,
  reservationId: string,
): number | undefined {
  if (!hasReservation(reservations, reservationId)) {
    return undefined;
  }

  return reservations[reservationId];
}

export function reservedQuantity(reservations: Record<string, number>): number {
  return Object.values(reservations).reduce((total, quantity) => total + quantity, 0);
}
