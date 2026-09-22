import { describe, it, expect } from "vitest";
import { orderConfirmationMessages } from "./messages";

const pay = { paybill: "247247", accountRef: "FC-0007", amount: 1200 };

describe("orderConfirmationMessages", () => {
  it("confirms in English by default", () => {
    const [received, payment] = orderConfirmationMessages("FC-0007", pay);
    expect(received.body).toContain("Order FC-0007 received");
    expect(payment.body).toContain("To complete your order");
    if (payment.kind === "buttons") {
      expect(payment.buttons.map((b) => b.title).join(" ")).toContain("I've paid");
    }
  });

  it("confirms in Swahili when lang = sw", () => {
    const [received, payment] = orderConfirmationMessages("FC-0007", pay, "sw");
    expect(received.body).toContain("Oda FC-0007 imepokelewa");
    expect(payment.body).toContain("Kukamilisha oda yako");
    expect(payment.body).toContain("247247");
    if (payment.kind === "buttons") {
      expect(payment.buttons.map((b) => b.title).join(" ")).toContain("Nimelipa");
    }
  });
});
