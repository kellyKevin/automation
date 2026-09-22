import { describe, it, expect } from "vitest";
import { groupDispatch, packTotals, methodLabel, type DispatchOrder } from "./group";

function order(p: Partial<DispatchOrder>): DispatchOrder {
  return {
    number: "FC-0001",
    status: "PACKED",
    paymentStatus: "PAID",
    total: 0,
    origin: "JUJA_HUB",
    method: "LOCAL_RIDER",
    zoneName: null,
    county: null,
    town: null,
    address: null,
    landmark: null,
    receiverName: null,
    receiverPhone: null,
    assignedTo: null,
    trackingNumber: null,
    items: [],
    ...p,
  };
}

describe("groupDispatch", () => {
  it("splits local-rider orders (by zone) from courier orders (by method + region)", () => {
    const g = groupDispatch([
      order({ number: "FC-2", method: "LOCAL_RIDER", zoneName: "Juja" }),
      order({ number: "FC-1", method: "LOCAL_RIDER", zoneName: "Juja" }),
      order({ number: "FC-3", method: "LOCAL_RIDER", zoneName: "Ruiru" }),
      order({ number: "FC-4", method: "COURIER", county: "Nakuru", origin: "ELDORET_NURSERY" }),
      order({ number: "FC-5", method: "PICKUP", town: "Eldoret", origin: "ELDORET_NURSERY" }),
    ]);
    expect(g.rider.map((x) => x.label)).toEqual(["Juja", "Ruiru"]);
    // Orders inside a zone are sorted by number.
    expect(g.rider[0].orders.map((o) => o.number)).toEqual(["FC-1", "FC-2"]);
    expect(g.courier.map((x) => x.label)).toEqual([
      "Courier — Nakuru",
      "Nursery pickup — Eldoret",
    ]);
  });

  it("labels a local-rider order with no zone as an unassigned area", () => {
    const g = groupDispatch([order({ method: "LOCAL_RIDER", zoneName: null })]);
    expect(g.rider[0].label).toBe("Unassigned area");
  });
});

describe("packTotals", () => {
  it("sums quantities per product + unit across the run", () => {
    const totals = packTotals([
      order({ items: [{ productName: "Tomatoes", quantity: 20, unit: "kg" }] }),
      order({
        items: [
          { productName: "Tomatoes", quantity: 22, unit: "kg" },
          { productName: "Eggs", quantity: 2, unit: "tray" },
        ],
      }),
    ]);
    expect(totals).toEqual([
      { productName: "Eggs", quantity: 2, unit: "tray" },
      { productName: "Tomatoes", quantity: 42, unit: "kg" },
    ]);
  });
});

describe("methodLabel", () => {
  it("maps known methods and falls back", () => {
    expect(methodLabel("BUS")).toBe("Bus / courier office");
    expect(methodLabel(null)).toBe("Delivery");
  });
});
