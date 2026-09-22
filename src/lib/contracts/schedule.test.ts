import { describe, it, expect } from "vitest";
import { advanceSchedule, isDue, rollForward, isFrequency } from "./schedule";

describe("advanceSchedule", () => {
  const base = new Date("2026-09-22T08:00:00Z");
  it("advances by the right interval", () => {
    expect(advanceSchedule("DAILY", base).toISOString()).toBe("2026-09-23T08:00:00.000Z");
    expect(advanceSchedule("WEEKLY", base).toISOString()).toBe("2026-09-29T08:00:00.000Z");
    expect(advanceSchedule("BIWEEKLY", base).toISOString()).toBe("2026-10-06T08:00:00.000Z");
    expect(advanceSchedule("MONTHLY", base).toISOString()).toBe("2026-10-22T08:00:00.000Z");
  });
  it("does not mutate its input", () => {
    advanceSchedule("WEEKLY", base);
    expect(base.toISOString()).toBe("2026-09-22T08:00:00.000Z");
  });
});

describe("isDue", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  it("is due when nextRunAt is now or past", () => {
    expect(isDue("2026-09-22T11:59:00Z", now)).toBe(true);
    expect(isDue("2026-09-22T12:00:00Z", now)).toBe(true);
    expect(isDue("2026-09-22T12:01:00Z", now)).toBe(false);
  });
});

describe("rollForward", () => {
  it("skips missed slots to the next future one (no backlog burst)", () => {
    const now = new Date("2026-09-22T12:00:00Z");
    // Weekly slot that lapsed three weeks ago.
    const stale = new Date("2026-09-01T08:00:00Z");
    const next = rollForward("WEEKLY", stale, now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.toISOString()).toBe("2026-09-29T08:00:00.000Z");
  });
});

describe("isFrequency", () => {
  it("guards the vocabulary", () => {
    expect(isFrequency("WEEKLY")).toBe(true);
    expect(isFrequency("HOURLY")).toBe(false);
  });
});
