import { describe, it, expect } from "vitest";
import { templateForStatus } from "./templates";

const ctx = {
  orderNumber: "FC-0007",
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

  it("returns null for statuses handled inside the window", () => {
    expect(templateForStatus("NEW", ctx)).toBeNull();
    expect(templateForStatus("CONFIRMED", ctx)).toBeNull();
    expect(templateForStatus("CANCELLED", ctx)).toBeNull();
  });
});
