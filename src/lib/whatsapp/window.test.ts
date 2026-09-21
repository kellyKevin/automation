import { describe, it, expect } from "vitest";
import { isWindowOpen, windowRemainingMs, WINDOW_MS } from "./window";

const now = new Date("2026-01-05T12:00:00Z");

describe("isWindowOpen", () => {
  it("is open within 24 hours of the last inbound message", () => {
    expect(isWindowOpen(new Date(now.getTime() - 60 * 60 * 1000), now)).toBe(true);
  });
  it("is closed after 24 hours", () => {
    expect(isWindowOpen(new Date(now.getTime() - WINDOW_MS - 1000), now)).toBe(false);
  });
  it("is closed exactly at the boundary", () => {
    expect(isWindowOpen(new Date(now.getTime() - WINDOW_MS), now)).toBe(false);
  });
  it("is closed for a customer who never messaged", () => {
    expect(isWindowOpen(null, now)).toBe(false);
    expect(isWindowOpen(undefined, now)).toBe(false);
  });
  it("accepts an ISO string", () => {
    expect(isWindowOpen(new Date(now.getTime() - 1000).toISOString(), now)).toBe(true);
  });
});

describe("windowRemainingMs", () => {
  it("is 0 when closed or never messaged", () => {
    expect(windowRemainingMs(null, now)).toBe(0);
    expect(windowRemainingMs(new Date(now.getTime() - WINDOW_MS), now)).toBe(0);
  });
  it("is positive while open", () => {
    expect(windowRemainingMs(new Date(now.getTime() - 1000), now)).toBeGreaterThan(0);
  });
});
