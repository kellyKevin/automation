import { describe, it, expect } from "vitest";
import {
  templateForStatus,
  paymentReminderTemplate,
  quoteReadyTemplate,
  standingOrderConfirmTemplate,
} from "./templates";

const ctx = {
  orderNumber: "FC-0007",
  total: "KSh 1,200",
  rider: "Sam",
  riderPhone: "0712000000",
  carrier: "G4S",
  tracking: "TRK1",
  eta: "Tue",
};

describe("templateForStatus", () => {
  it("maps single-variable statuses to their template", () => {
    expect(templateForStatus("PAID", ctx)).toEqual({ name: "payment_received", params: ["FC-0007"] });
    expect(templateForStatus("PACKED", ctx)).toEqual({ name: "order_packed", params: ["FC-0007"] });
    expect(templateForStatus("DELIVERED", ctx)).toEqual({ name: "order_delivered", params: ["FC-0007"] });
  });

  it("includes rider / courier variables", () => {
    expect(templateForStatus("OUT_FOR_DELIVERY", ctx)).toEqual({
      name: "out_for_delivery",
      params: ["FC-0007", "Sam", "0712000000"],
    });
    expect(templateForStatus("DISPATCHED", ctx)).toEqual({
      name: "seedlings_dispatched",
      params: ["FC-0007", "G4S", "TRK1", "Tue"],
    });
  });

  it("falls back to safe defaults when optional params are missing", () => {
    expect(templateForStatus("OUT_FOR_DELIVERY", { orderNumber: "FC-1" })).toEqual({
      name: "out_for_delivery",
      params: ["FC-1", "our rider", "-"],
    });
  });

  it("maps CONFIRMED to order_received with the order total", () => {
    expect(templateForStatus("CONFIRMED", ctx)).toEqual({
      name: "order_received",
      params: ["FC-0007", "KSh 1,200"],
    });
    // Falls back safely when the total isn't supplied.
    expect(templateForStatus("CONFIRMED", { orderNumber: "FC-1" })).toEqual({
      name: "order_received",
      params: ["FC-1", "-"],
    });
  });

  it("returns null for statuses handled inside the window", () => {
    expect(templateForStatus("NEW", ctx)).toBeNull();
    expect(templateForStatus("CANCELLED", ctx)).toBeNull();
  });

  it("builds the non-status templates in the approved variable order", () => {
    expect(paymentReminderTemplate("FC-9", "KSh 500", "247247")).toEqual({
      name: "payment_reminder",
      params: ["FC-9", "KSh 500", "247247"],
    });
    expect(quoteReadyTemplate("Green School", "KSh 40,000")).toEqual({
      name: "quote_ready",
      params: ["Green School", "KSh 40,000"],
    });
    expect(standingOrderConfirmTemplate("Hotel Bravo", "Every Monday")).toEqual({
      name: "standing_order_confirm",
      params: ["Hotel Bravo", "Every Monday"],
    });
  });
});
