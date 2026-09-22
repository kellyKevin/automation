import { describe, it, expect } from "vitest";
import { salesTotals, topProducts } from "./aggregate";

describe("salesTotals", () => {
  it("sums orders, splitting paid vs unpaid and ignoring cancelled", () => {
    const t = salesTotals([
      { total: 1000, paymentStatus: "PAID", status: "DELIVERED" },
      { total: 500, paymentStatus: "PENDING", status: "NEW" },
      { total: 800, paymentStatus: "PAID", status: "PACKED" },
      { total: 999, paymentStatus: "PENDING", status: "CANCELLED" }, // ignored
    ]);
    expect(t.orders).toBe(3);
    expect(t.revenue).toBe(2300);
    expect(t.paidOrders).toBe(2);
    expect(t.paidRevenue).toBe(1800);
    expect(t.unpaidOrders).toBe(1);
    expect(t.unpaidValue).toBe(500);
  });

  it("handles an empty period", () => {
    expect(salesTotals([])).toMatchObject({ orders: 0, revenue: 0, paidRevenue: 0 });
  });
});

describe("topProducts", () => {
  it("aggregates by name and ranks by quantity then revenue", () => {
    const top = topProducts([
      { productName: "Tomatoes", quantity: 5, lineTotal: 500 },
      { productName: "Onions", quantity: 10, lineTotal: 400 },
      { productName: "Tomatoes", quantity: 3, lineTotal: 300 },
    ]);
    expect(top[0]).toEqual({ productName: "Onions", quantity: 10, revenue: 400, orderLines: 1 });
    expect(top[1]).toEqual({ productName: "Tomatoes", quantity: 8, revenue: 800, orderLines: 2 });
  });

  it("respects the limit", () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      productName: `P${i}`,
      quantity: i,
      lineTotal: i,
    }));
    expect(topProducts(rows, 5)).toHaveLength(5);
  });
});
