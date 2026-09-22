// Farm City operates in Kenya (East Africa Time, UTC+3, no daylight saving).
// A bare calendar date from a date picker (YYYY-MM-DD) is otherwise parsed as
// midnight UTC, which is 3am EAT — so "today" can look like the future to a
// UTC server. These helpers pin a bare date to the EAT day the user meant.

export const EAT_OFFSET = "+03:00";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Start of the given day in EAT (or the value as-is if it already has a time). */
export function eatStartOfDay(value: string): Date {
  return DATE_ONLY.test(value) ? new Date(`${value}T00:00:00.000${EAT_OFFSET}`) : new Date(value);
}

/** End of the given day in EAT, so a period/filter includes the whole day. */
export function eatEndOfDay(value: string): Date {
  return DATE_ONLY.test(value) ? new Date(`${value}T23:59:59.999${EAT_OFFSET}`) : new Date(value);
}
