import { describe, it, expect } from "vitest";
import { parseDeliveryUpdate } from "./delivery";

describe("parseDeliveryUpdate", () => {
  it("accepts an assignee and tracking number", () => {
    const r = parseDeliveryUpdate({ assignedTo: "Sam", trackingNumber: "TRK-9" });
    expect(r).toEqual({ ok: true, data: { assignedTo: "Sam", trackingNumber: "TRK-9" } });
  });

  it("clears a nullable field when passed a blank string", () => {
    const r = parseDeliveryUpdate({ assignedTo: "  " });
    expect(r.ok && r.data.assignedTo).toBeNull();
  });

  it("validates the method", () => {
    expect(parseDeliveryUpdate({ method: "COURIER" }).ok).toBe(true);
    expect(parseDeliveryUpdate({ method: "PLANE" })).toEqual({ ok: false, error: "Invalid delivery method" });
  });

  it("parses a requested date and rejects a bad one", () => {
    const r = parseDeliveryUpdate({ requestedDate: "2026-09-24" });
    expect(r.ok && r.data.requestedDate instanceof Date).toBe(true);
    expect(parseDeliveryUpdate({ requestedDate: "not-a-date" })).toEqual({ ok: false, error: "Invalid date" });
  });

  it("rejects an empty update", () => {
    expect(parseDeliveryUpdate({})).toEqual({ ok: false, error: "No fields to update" });
    expect(parseDeliveryUpdate(null)).toEqual({ ok: false, error: "Invalid request body" });
  });
});
