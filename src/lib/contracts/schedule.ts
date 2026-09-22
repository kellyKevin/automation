// Recurring schedule maths for standing orders (Phase 2). Pure so it is easy
// to test and free of any database or clock dependency.

export const FREQUENCIES = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export function isFrequency(v: unknown): v is Frequency {
  return typeof v === "string" && (FREQUENCIES as readonly string[]).includes(v);
}

/** The next run time after `from` for a given frequency. */
export function advanceSchedule(frequency: Frequency, from: Date): Date {
  const d = new Date(from.getTime());
  switch (frequency) {
    case "DAILY":
      d.setDate(d.getDate() + 1);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "BIWEEKLY":
      d.setDate(d.getDate() + 14);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

/** Is a standing order due to generate an order at `now`? */
export function isDue(nextRunAt: Date | string, now: Date = new Date()): boolean {
  return new Date(nextRunAt).getTime() <= now.getTime();
}

/**
 * Roll `nextRunAt` forward until it is in the future. A job that hasn't run for
 * a while (downtime) then produces exactly one next slot, not a backlog burst.
 */
export function rollForward(frequency: Frequency, nextRunAt: Date, now: Date = new Date()): Date {
  let next = new Date(nextRunAt.getTime());
  // Guard against a pathological loop; a year of daily slots is the worst case.
  for (let i = 0; i < 400 && next.getTime() <= now.getTime(); i++) {
    next = advanceSchedule(frequency, next);
  }
  return next;
}
