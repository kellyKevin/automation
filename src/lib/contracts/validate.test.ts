import { describe, it, expect } from "vitest";
import { parseStandingOrder } from "./validate";

const validItem = { productName: "Tomatoes", quantity: 20, unit: "kg", unitPrice: 90 };

describe("parseStandingOrder", () => {
  it("accepts a well-formed standing order and applies defaults", () => {
    const r = parseStandingOrder({
      contractId: "c1",
      frequency: "WEEKLY",
      items: [validItem],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.origin).toBe("JUJA_HUB");
      expect(r.data.method).toBe("LOCAL_RIDER");
      expect(r.data.items).toHaveLength(1);
      expect(r.data.nextRunAt instanceof Date).toBe(true);
    }
  });

  it("requires a contract, a valid frequency and at least one item", () => {
    expect(parseStandingOrder({ frequency: "WEEKLY", items: [validItem] })).toMatchObject({ ok: false });
    expect(parseStandingOrder({ contractId: "c1", frequency: "YEARLY", items: [validItem] })).toEqual({
      ok: false,
      error: "Invalid frequency",
    });
    expect(parseStandingOrder({ contractId: "c1", frequency: "WEEKLY", items: [] })).toEqual({
      ok: false,
      error: "Add at least one item",
    });
  });

  it("rejects an item missing a quantity or price", () => {
    const r = parseStandingOrder({
      contractId: "c1",
      frequency: "WEEKLY",
      items: [{ productName: "Kale", unit: "bunch" }],
    });
    expect(r).toMatchObject({ ok: false });
  });

  it("parses a start date as EAT start-of-day and rejects a bad one", () => {
    const good = parseStandingOrder({ contractId: "c1", frequency: "DAILY", items: [validItem], startAt: "2026-10-01" });
    // 2026-10-01 00:00 EAT === 2026-09-30 21:00 UTC.
    expect(good.ok && good.data.nextRunAt.toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(parseStandingOrder({ contractId: "c1", frequency: "DAILY", items: [validItem], startAt: "nope" })).toEqual({
      ok: false,
      error: "Invalid start date",
    });
  });
});
