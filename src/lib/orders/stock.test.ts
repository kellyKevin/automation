import { describe, it, expect } from "vitest";
import { availableStock, holdsReservation } from "./stock";

describe("availableStock", () => {
  it("is stock minus reserved, floored at 0", () => {
    expect(availableStock(100, 30)).toBe(70);
    expect(availableStock(10, 25)).toBe(0);
    expect(availableStock(5, 0)).toBe(5);
  });
});

describe("holdsReservation", () => {
  it("holds while the order is open, before packing", () => {
    expect(holdsReservation("NEW")).toBe(true);
    expect(holdsReservation("CONFIRMED")).toBe(true);
    expect(holdsReservation("PAID")).toBe(true);
    expect(holdsReservation("ON_HOLD")).toBe(true);
  });
  it("does not hold once packed or beyond, or when terminal", () => {
    expect(holdsReservation("PACKED")).toBe(false);
    expect(holdsReservation("OUT_FOR_DELIVERY")).toBe(false);
    expect(holdsReservation("DISPATCHED")).toBe(false);
    expect(holdsReservation("DELIVERED")).toBe(false);
    expect(holdsReservation("CANCELLED")).toBe(false);
  });
});
