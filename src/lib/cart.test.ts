import { describe, it, expect } from "vitest";
import {
  parseOrderMessage,
  formatOrderMessage,
  buildWhatsAppLink,
  generateCartRef,
} from "./cart";

describe("parseOrderMessage", () => {
  it("parses the standard pre-filled message", () => {
    const msg = [
      "Hello Farm City, I'd like to order:",
      "• Tomatoes x 5 kg",
      "• Eggs x 2 trays",
      "Ref: CART-8F3K",
    ].join("\n");
    const parsed = parseOrderMessage(msg);
    expect(parsed.ref).toBe("CART-8F3K");
    expect(parsed.items).toEqual([
      { name: "Tomatoes", quantity: 5, unit: "kg" },
      { name: "Eggs", quantity: 2, unit: "trays" },
    ]);
  });

  it("handles the × multiplication sign and different bullets", () => {
    const parsed = parseOrderMessage("- Kale × 3 bunches\n* Onions × 2 kg");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toMatchObject({ name: "Kale", quantity: 3, unit: "bunches" });
  });

  it("handles quantity-first phrasing", () => {
    const parsed = parseOrderMessage("5 kg tomatoes\n2 trays of eggs");
    expect(parsed.items).toEqual([
      { name: "tomatoes", quantity: 5, unit: "kg" },
      { name: "eggs", quantity: 2, unit: "trays" },
    ]);
  });

  it("returns no items for a free-text enquiry", () => {
    const parsed = parseOrderMessage("Hi, do you have avocado seedlings?");
    expect(parsed.items).toHaveLength(0);
    expect(parsed.ref).toBeUndefined();
  });

  it("parses the storefront 'place an order' format (numbered, priced, with name & location)", () => {
    const msg = [
      "Hello Farm City, I would like to place an order:",
      "",
      "1. Grafted Passion Fruit Seedlings - 4 seedling (KSh 200)",
      "",
      "Total Estimated: KSh 200",
      "Name: kelly",
      "Delivery Location: langata, Nairobi",
      "",
      "Please confirm availability and delivery fees.",
    ].join("\n");
    const parsed = parseOrderMessage(msg);
    expect(parsed.items).toEqual([
      { name: "Grafted Passion Fruit Seedlings", quantity: 4, unit: "seedling" },
    ]);
    expect(parsed.customerName).toBe("kelly");
    expect(parsed.deliveryLocation).toBe("langata, Nairobi");
  });

  it("parses a multi-line numbered order and ignores prices/totals", () => {
    const msg = [
      "Hello Farm City, I would like to place an order:",
      "1. Fresh Cabbage - 2 kg (KSh 150)",
      "2. Kale / Sukuma Wiki - 3 kg (KSh 270)",
      "Total Estimated: KSh 420",
      "Name: Grace Wanjiru",
    ].join("\n");
    const parsed = parseOrderMessage(msg);
    expect(parsed.items).toEqual([
      { name: "Fresh Cabbage", quantity: 2, unit: "kg" },
      { name: "Kale / Sukuma Wiki", quantity: 3, unit: "kg" },
    ]);
    expect(parsed.customerName).toBe("Grace Wanjiru");
  });

  it("round-trips format -> parse", () => {
    const ref = generateCartRef();
    const items = [{ name: "Tomatoes", quantity: 5, unit: "kg" }];
    const msg = formatOrderMessage(items, ref);
    const parsed = parseOrderMessage(msg);
    expect(parsed.ref).toBe(ref);
    expect(parsed.items[0]).toMatchObject({ name: "Tomatoes", quantity: 5, unit: "kg" });
  });
});

describe("generateCartRef", () => {
  it("produces a CART- prefixed ref without ambiguous chars", () => {
    for (let i = 0; i < 50; i++) {
      const ref = generateCartRef();
      expect(ref).toMatch(/^CART-[A-Z2-9]{4}$/);
      expect(ref).not.toMatch(/[O0I1]/);
    }
  });
});

describe("buildWhatsAppLink", () => {
  it("strips non-digits and encodes the message", () => {
    const link = buildWhatsAppLink("+254 700 000 000", "Hello & welcome");
    expect(link).toBe("https://wa.me/254700000000?text=Hello%20%26%20welcome");
  });
});
