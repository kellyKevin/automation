import { describe, it, expect } from "vitest";
import { parseProductUpdate, parseProductCreate, slugify } from "./update";

describe("slugify", () => {
  it("makes a URL-safe slug", () => {
    expect(slugify("Grafted Hass Avocado Seedlings")).toBe("grafted-hass-avocado-seedlings");
    expect(slugify("Kale / Sukuma Wiki")).toBe("kale-sukuma-wiki");
  });
});

describe("parseProductCreate", () => {
  it("accepts a valid product and derives slug + origin", () => {
    const r = parseProductCreate({ name: "Test Mango", category: "produce", unit: "kg", price: 90, stock: 12 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toMatchObject({
        slug: "test-mango",
        name: "Test Mango",
        category: "produce",
        origin: "JUJA_HUB",
        unit: "kg",
        price: 90,
        stock: 12,
        available: true,
      });
    }
  });
  it("routes seedlings to the nursery origin", () => {
    const r = parseProductCreate({ name: "Apple Seedling", category: "seedling", unit: "seedling", price: 1000 });
    expect(r.ok && r.data.origin).toBe("ELDORET_NURSERY");
  });
  it("rejects missing/invalid fields", () => {
    expect(parseProductCreate({ category: "produce", unit: "kg", price: 1 }).ok).toBe(false);
    expect(parseProductCreate({ name: "x", category: "food", unit: "kg", price: 1 }).ok).toBe(false);
    expect(parseProductCreate({ name: "x", category: "produce", unit: "kg", price: -1 }).ok).toBe(false);
  });
});

describe("parseProductUpdate", () => {
  it("accepts valid price / stock / available / imageUrl", () => {
    const r = parseProductUpdate({ price: 120, stock: 50, available: true, imageUrl: " x.jpg " });
    expect(r).toEqual({ ok: true, data: { price: 120, stock: 50, available: true, imageUrl: "x.jpg" } });
  });

  it("coerces numeric strings", () => {
    const r = parseProductUpdate({ price: "90", stock: "10" });
    expect(r).toEqual({ ok: true, data: { price: 90, stock: 10 } });
  });

  it("treats empty/null imageUrl as clearing it", () => {
    expect(parseProductUpdate({ imageUrl: null })).toEqual({ ok: true, data: { imageUrl: null } });
    expect(parseProductUpdate({ imageUrl: "" })).toEqual({ ok: true, data: { imageUrl: null } });
  });

  it("rejects negative or non-numeric price/stock", () => {
    expect(parseProductUpdate({ price: -1 }).ok).toBe(false);
    expect(parseProductUpdate({ stock: "abc" }).ok).toBe(false);
  });

  it("rejects non-boolean available", () => {
    expect(parseProductUpdate({ available: "yes" }).ok).toBe(false);
  });

  it("rejects an empty update", () => {
    expect(parseProductUpdate({}).ok).toBe(false);
    expect(parseProductUpdate(null).ok).toBe(false);
  });
});
