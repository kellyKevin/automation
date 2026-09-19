import { describe, it, expect } from "vitest";
import { canTransition, originForCategory } from "./index";

describe("canTransition", () => {
  it("allows the happy-path lifecycle", () => {
    expect(canTransition("NEW", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "PAID")).toBe(true);
    expect(canTransition("PAID", "PACKED")).toBe(true);
    expect(canTransition("PACKED", "OUT_FOR_DELIVERY")).toBe(true);
    expect(canTransition("PACKED", "DISPATCHED")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED")).toBe(true);
    expect(canTransition("DISPATCHED", "DELIVERED")).toBe(true);
  });

  it("forbids skipping and going backwards", () => {
    expect(canTransition("NEW", "PACKED")).toBe(false);
    expect(canTransition("DELIVERED", "PACKED")).toBe(false);
    expect(canTransition("PAID", "NEW")).toBe(false);
  });

  it("treats terminal states as terminal", () => {
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "NEW")).toBe(false);
  });

  it("allows cancel/hold from active states and resume from hold", () => {
    expect(canTransition("NEW", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "ON_HOLD")).toBe(true);
    expect(canTransition("ON_HOLD", "CONFIRMED")).toBe(true);
  });

  it("rejects self-transition", () => {
    expect(canTransition("NEW", "NEW")).toBe(false);
  });
});

describe("originForCategory", () => {
  it("routes seedlings to the nursery and everything else to the hub", () => {
    expect(originForCategory("seedling")).toBe("ELDORET_NURSERY");
    expect(originForCategory("produce")).toBe("JUJA_HUB");
    expect(originForCategory("grocery")).toBe("JUJA_HUB");
  });
});
