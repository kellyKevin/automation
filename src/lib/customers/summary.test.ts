import { describe, it, expect } from "vitest";
import { customerStats } from "./summary";

describe("customerStats", () => {
  it("counts non-cancelled orders, splits spend, and finds the last order", () => {
    const s = customerStats([
      { total: 1000, paymentStatus: "PAID", status: "DELIVERED", createdAt: "2026-01-01T00:00:00Z" },
      { total: 500, paymentStatus: "PENDING", status: "NEW", createdAt: "2026-03-01T00:00:00Z" },
      { total: 999, paymentStatus: "PENDING", status: "CANCELLED", createdAt: "2026-04-01T00:00:00Z" },
    ]);
    expect(s.orders).toBe(2);
    expect(s.paidOrders).toBe(1);
    expect(s.totalSpent).toBe(1000);
    expect(s.outstanding).toBe(500);
    expect(s.lastOrderAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("handles a customer with no orders", () => {
    expect(customerStats([])).toEqual({
      orders: 0,
      paidOrders: 0,
      totalSpent: 0,
      outstanding: 0,
      lastOrderAt: null,
    });
  });
});
