// Order numbers are sequential and unique: FC-0001, FC-0002, ... They appear
// everywhere, including the M-Pesa payment reference.

export const ORDER_NUMBER_PREFIX = "FC";

/** Format a sequence number as a padded order number, e.g. 142 -> "FC-0142". */
export function formatOrderNumber(seq: number, prefix = ORDER_NUMBER_PREFIX): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Invalid order sequence: ${seq}`);
  }
  return `${prefix}-${seq.toString().padStart(4, "0")}`;
}

/** Parse an order number back to its sequence, or null if it doesn't match. */
export function parseOrderNumber(value: string, prefix = ORDER_NUMBER_PREFIX): number | null {
  const m = value.trim().toUpperCase().match(new RegExp(`^${prefix}-(\\d+)$`));
  return m ? parseInt(m[1], 10) : null;
}
