import { describe, it, expect } from "vitest";
import { computeTotals, computeDiscount } from "./pricing";
import type { DraftItem } from "./types";

function item(partial: Partial<DraftItem>): DraftItem {
  return {
    name: "X",
    quantity: 1,
    unit: "kg",
    unitPrice: 100,
    available: true,
    resolved: true,
    ...partial,
  };
}

describe("computeTotals", () => {
  it("sums line totals and adds the delivery fee", () => {
    const items = [
      item({ quantity: 5, unitPrice: 120 }), // 600
      item({ quantity: 2, unitPrice: 420, unit: "tray" }), // 840
    ];
    const totals = computeTotals(items, 100);
    expect(totals.subtotal).toBe(1440);
    expect(totals.discount).toBe(0);
    expect(totals.deliveryFee).toBe(100);
    expect(totals.total).toBe(1540);
  });

  it("applies a 10% bulk discount on 200+ seedlings", () => {
    const items = [item({ unit: "seedling", quantity: 300, unitPrice: 8 })]; // 2400
    const totals = computeTotals(items, 400);
    expect(totals.subtotal).toBe(2400);
    expect(totals.discount).toBe(240);
    expect(totals.total).toBe(2560); // 2400 - 240 + 400
  });

  it("applies a 5% discount on 50+ units of produce", () => {
    expect(computeDiscount([item({ quantity: 50, unitPrice: 100 })])).toBe(250);
  });
});
