import { describe, it, expect } from "vitest";
import { parseBulkQuote } from "./quote";

describe("parseBulkQuote", () => {
  it("maps the storefront form fields", () => {
    const r = parseBulkQuote({
      type: "institutional",
      organizationName: "Green School",
      contactPerson: "Grace",
      phone: "0712345678",
      email: "grace@x.com",
      county: "Kiambu",
      town: "Juja",
      productsRequired: "Tomatoes, Cabbage",
      estimatedQuantities: "50kg weekly",
      frequencyOfSupply: "Weekly",
      preferredDeliveryDate: "Mondays",
      additionalInfo: "LPO required",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toMatchObject({
        organisation: "Green School",
        type: "institutional",
        contactPerson: "Grace",
        phone: "0712345678",
        itemsSummary: "Tomatoes, Cabbage",
        quantity: "50kg weekly",
        frequency: "Weekly",
        location: "Juja, Kiambu",
      });
      expect(r.data.notes).toContain("Preferred date: Mondays");
      expect(r.data.notes).toContain("LPO required");
    }
  });

  it("requires products and a phone", () => {
    expect(parseBulkQuote({ phone: "0712" }).ok).toBe(false);
    expect(parseBulkQuote({ productsRequired: "x" }).ok).toBe(false);
  });
});
