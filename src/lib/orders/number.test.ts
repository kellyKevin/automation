import { describe, it, expect } from "vitest";
import { formatOrderNumber, parseOrderNumber } from "./number";

describe("formatOrderNumber", () => {
  it("pads to four digits", () => {
    expect(formatOrderNumber(1)).toBe("FC-0001");
    expect(formatOrderNumber(142)).toBe("FC-0142");
  });
  it("does not truncate beyond four digits", () => {
    expect(formatOrderNumber(12345)).toBe("FC-12345");
  });
  it("rejects invalid sequences", () => {
    expect(() => formatOrderNumber(0)).toThrow();
    expect(() => formatOrderNumber(-1)).toThrow();
    expect(() => formatOrderNumber(1.5)).toThrow();
  });
});

describe("parseOrderNumber", () => {
  it("round-trips", () => {
    expect(parseOrderNumber(formatOrderNumber(142))).toBe(142);
  });
  it("is case-insensitive and returns null for non-matches", () => {
    expect(parseOrderNumber("fc-0007")).toBe(7);
    expect(parseOrderNumber("CART-8F3K")).toBeNull();
  });
});
