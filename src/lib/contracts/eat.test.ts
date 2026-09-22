import { describe, it, expect } from "vitest";
import { eatStartOfDay, eatEndOfDay } from "./eat";

describe("EAT date helpers", () => {
  it("pins a bare date to the start of that day in EAT (UTC+3)", () => {
    // 2026-09-22 00:00 EAT === 2026-09-21 21:00 UTC.
    expect(eatStartOfDay("2026-09-22").toISOString()).toBe("2026-09-21T21:00:00.000Z");
  });

  it("pins a bare date to the end of that day in EAT", () => {
    expect(eatEndOfDay("2026-09-22").toISOString()).toBe("2026-09-22T20:59:59.999Z");
  });

  it("means a first-run of 'today' is already due for the whole EAT day", () => {
    // Any UTC 'now' during the EAT day of the 22nd is after 21:00 UTC on the 21st.
    const now = new Date("2026-09-22T06:00:00Z"); // 9am EAT
    expect(eatStartOfDay("2026-09-22").getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it("passes through a full datetime unchanged", () => {
    expect(eatStartOfDay("2026-09-22T10:30:00Z").toISOString()).toBe("2026-09-22T10:30:00.000Z");
  });
});
