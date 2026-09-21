import { describe, it, expect } from "vitest";
import { parseProductUpdate } from "./update";

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
