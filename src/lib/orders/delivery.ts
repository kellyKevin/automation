// Validation + mapping for a delivery update (Part 11 — delivery editor).
// Pure so it is easy to test and shared by the API route.

export const DELIVERY_METHODS = ["LOCAL_RIDER", "COURIER", "BUS", "PICKUP"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export interface DeliveryUpdate {
  method?: DeliveryMethod;
  assignedTo?: string | null;
  trackingNumber?: string | null;
  timeWindow?: string | null;
  requestedDate?: Date | null;
}

export type DeliveryParseResult =
  | { ok: true; data: DeliveryUpdate }
  | { ok: false; error: string };

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Parse an incoming delivery patch. Only the keys present are updated; a
 * blank string clears a nullable text field. */
export function parseDeliveryUpdate(input: unknown): DeliveryParseResult {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid request body" };
  const b = input as Record<string, unknown>;
  const data: DeliveryUpdate = {};

  if ("method" in b) {
    const m = str(b.method);
    if (!m || !(DELIVERY_METHODS as readonly string[]).includes(m)) {
      return { ok: false, error: "Invalid delivery method" };
    }
    data.method = m as DeliveryMethod;
  }
  if ("assignedTo" in b) data.assignedTo = str(b.assignedTo);
  if ("trackingNumber" in b) data.trackingNumber = str(b.trackingNumber);
  if ("timeWindow" in b) data.timeWindow = str(b.timeWindow);
  if ("requestedDate" in b) {
    const raw = str(b.requestedDate);
    if (raw === null) {
      data.requestedDate = null;
    } else {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid date" };
      data.requestedDate = d;
    }
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No fields to update" };
  }
  return { ok: true, data };
}
