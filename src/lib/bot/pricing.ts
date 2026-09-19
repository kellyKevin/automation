import type { DraftItem } from "./types";

export interface Totals {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

// Bulk discount rules (simple, tunable):
//  - Seedling lines of 200+ units get 10% off that line.
//  - Any single line of 50+ units of produce gets 5% off that line.
export function computeDiscount(items: DraftItem[]): number {
  let discount = 0;
  for (const it of items) {
    const line = it.quantity * it.unitPrice;
    const isSeedling = it.unit === "seedling" || it.unit === "tray";
    if (isSeedling && it.quantity >= 200) {
      discount += line * 0.1;
    } else if (it.quantity >= 50) {
      discount += line * 0.05;
    }
  }
  return round2(discount);
}

export function computeTotals(items: DraftItem[], deliveryFee: number): Totals {
  const subtotal = round2(
    items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0),
  );
  const discount = computeDiscount(items);
  const fee = round2(deliveryFee || 0);
  const total = round2(subtotal - discount + fee);
  return { subtotal, discount, deliveryFee: fee, total };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
