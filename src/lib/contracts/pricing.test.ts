import { describe, it, expect } from "vitest";
import {
  priceIndex,
  applyContractPrices,
  formatInvoiceNumber,
  buildInvoiceLines,
  invoiceTotals,
} from "./pricing";

describe("contract price lists", () => {
  const index = priceIndex([
    { slug: "tomatoes", productName: "Tomatoes", unitPrice: 80 },
    { slug: null, productName: "Kale", unitPrice: 30 },
  ]);

  it("overrides matching items by slug or name and leaves others alone", () => {
    const out = applyContractPrices(
      [
        { slug: "tomatoes", name: "Tomatoes", quantity: 10, unit: "kg", unitPrice: 100 },
        { name: "Kale", quantity: 2, unit: "bunch", unitPrice: 40 },
        { slug: "onions", name: "Onions", quantity: 3, unit: "kg", unitPrice: 60 },
      ],
      index,
    );
    expect(out[0].unitPrice).toBe(80); // by slug
    expect(out[1].unitPrice).toBe(30); // by name
    expect(out[2].unitPrice).toBe(60); // untouched
  });
});

describe("invoice helpers", () => {
  it("formats invoice numbers", () => {
    expect(formatInvoiceNumber(1)).toBe("INV-0001");
    expect(formatInvoiceNumber(142)).toBe("INV-0142");
    expect(() => formatInvoiceNumber(0)).toThrow();
  });

  it("builds one line per order and totals them", () => {
    const lines = buildInvoiceLines([
      { id: "o1", number: "FC-0001", total: 1200 },
      { id: "o2", number: "FC-0002", total: 800 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ orderNumber: "FC-0001", lineTotal: 1200 });
    expect(invoiceTotals(lines)).toEqual({ subtotal: 2000, total: 2000 });
  });
});
