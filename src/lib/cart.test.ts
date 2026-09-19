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
