// Stock lifecycle (Part 10):
//   reserve on order create -> deduct on packed -> release on cancel / unpaid.
//
// Product.stock is the physical quantity; Product.reserved is what open orders
// are holding. Available to sell = stock - reserved. Pure helpers here; the DB
// mutations live in service.ts.

import type { OrderStatus } from "@/domain";

export function availableStock(stock: number, reserved: number): number {
  return Math.max(0, stock - reserved);
}

// A reservation is held from NEW until the order is packed (fulfilled) or the
// order is cancelled/lapses before packing (released). Once packed, the stock
// is physically deducted and the reservation is gone.
const RESERVED_STATUSES: OrderStatus[] = ["NEW", "CONFIRMED", "PAID", "ON_HOLD"];

/** Does an order in this status still hold a stock reservation? */
export function holdsReservation(status: OrderStatus): boolean {
  return RESERVED_STATUSES.includes(status);
}
