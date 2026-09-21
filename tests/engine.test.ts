import { describe, it, expect } from "vitest";
import { handleTurn, extractMpesaCode, parseReceiver } from "@/lib/bot/engine";
import { emptyDraft, type OrderDraft, type KnownCustomer } from "@/lib/bot/types";
import type { ConversationStep } from "@/domain";
import type { OutboundMessage } from "@/lib/whatsapp/messages";
import { catalog, morning } from "./fixtures";

const newCustomer: KnownCustomer = { isReturning: false };
const returning: KnownCustomer = { isReturning: true, name: "Grace" };

// A tiny driver that threads step + draft between turns.
class Convo {
  step: ConversationStep = "IDLE";
  draft: OrderDraft = emptyDraft();
  replies: OutboundMessage[] = [];
  effects: string[] = [];

  constructor(private customer: KnownCustomer = newCustomer) {}

  send(input: { text?: string; replyId?: string }) {
    const res = handleTurn({
      step: this.step,
      draft: this.draft,
      customer: this.customer,
      catalog,
      text: input.text,
      replyId: input.replyId,
      now: morning,
    });
    this.step = res.step;
    this.draft = res.draft;
    this.replies = res.replies;
    this.effects = res.effects.map((e) => e.type);
    return res;
  }

  get bodies() {
    return this.replies
      .map((r) => (r.kind === "text" ? r.body : r.body))
      .join("\n");
  }
}

const CART = [
  "Hello Farm City, I'd like to order:",
  "• Tomatoes x 5 kg",
  "• Eggs x 2 trays",
  "Ref: CART-8F3K",
].join("\n");

describe("produce order — full happy path", () => {
  it("walks from cart message to a CREATE_ORDER effect", () => {
    const c = new Convo(newCustomer);

    c.send({ text: CART });
    expect(c.step).toBe("CONFIRM_ITEMS");
    expect(c.draft.path).toBe("produce");
    expect(c.draft.ref).toBe("CART-8F3K");

    c.send({ replyId: "items_yes" });
    expect(c.step).toBe("ASK_NAME");

    c.send({ text: "Grace" });
    expect(c.step).toBe("PRODUCE_ZONE");
    expect(c.effects).toContain("SAVE_CUSTOMER_NAME");

    c.send({ replyId: "zone_z-juja" });
    expect(c.step).toBe("PRODUCE_LOCATION");
    expect(c.draft.delivery.zoneName).toBe("Juja Town");
    expect(c.draft.delivery.fee).toBe(100);

    c.send({ text: "Greenpark Estate, near the shell" });
    expect(c.step).toBe("PRODUCE_DAY");

    c.send({ replyId: "day_today" });
    expect(c.step).toBe("PRODUCE_RECEIVER");

    const res = c.send({ text: "Grace, 0712345678" });
    expect(c.step).toBe("SUMMARY");
    expect(res.replies.some((r) => r.kind === "text" && /Total:/.test(r.body))).toBe(true);

    const confirm = c.send({ replyId: "sum_confirm" });
    expect(c.step).toBe("AWAIT_PAYMENT");
    expect(confirm.effects.map((e) => e.type)).toContain("CREATE_ORDER");
    const createEffect = confirm.effects.find((e) => e.type === "CREATE_ORDER");
    expect(createEffect).toBeTruthy();
    if (createEffect && createEffect.type === "CREATE_ORDER") {
      expect(createEffect.draft.items).toHaveLength(2);
      expect(createEffect.draft.delivery.receiverName).toBe("Grace");
      expect(createEffect.draft.delivery.receiverPhone).toBe("0712345678");
    }
  });

  it("greets a returning customer by name and skips ASK_NAME", () => {
    const c = new Convo(returning);
    c.send({ text: CART });
    c.send({ replyId: "items_yes" });
    expect(c.step).toBe("PRODUCE_ZONE");
    expect(c.draft.customerName).toBe("Grace");
  });
});

describe("seedling order path", () => {
  it("collects county, town, method, receiver, date", () => {
    const c = new Convo(returning);
    c.send({ text: "• Tomato Seedling x 300 seedling\nRef: CART-XX9Z" });
    expect(c.draft.path).toBe("seedling");
    expect(c.draft.origin).toBe("ELDORET_NURSERY");

    c.send({ replyId: "items_yes" });
    expect(c.step).toBe("SEEDLING_COUNTY");

    c.send({ text: "Uasin Gishu" });
    expect(c.step).toBe("SEEDLING_TOWN");

    c.send({ text: "Eldoret" });
    expect(c.step).toBe("SEEDLING_METHOD");

    c.send({ replyId: "method_door" });
    expect(c.step).toBe("SEEDLING_RECEIVER");
    expect(c.draft.delivery.method).toBe("COURIER");

    c.send({ text: "John, 0722000111" });
    expect(c.step).toBe("SEEDLING_DATE");

    const res = c.send({ text: "24 Jan" });
    expect(c.step).toBe("SUMMARY");
    expect(res.replies.some((r) => r.kind === "text" && /Total:/.test(r.body))).toBe(true);
  });
});

describe("storefront 'place an order' message", () => {
  const REAL = [
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

  it("routes a real customer message to the seedling path and skips ASK_NAME", () => {
    const c = new Convo(newCustomer); // new customer, but the message states a name
    c.send({ text: REAL });
    expect(c.step).toBe("CONFIRM_ITEMS");
    expect(c.draft.path).toBe("seedling");
    expect(c.draft.customerName).toBe("kelly");
    expect(c.draft.items).toEqual([
      expect.objectContaining({ name: "Grafted Passion Fruit Seedlings", quantity: 4, unit: "seedling", available: true }),
    ]);

    const res = c.send({ replyId: "items_yes" });
    // Name already known from the message -> straight to the seedling flow.
    expect(c.step).toBe("SEEDLING_COUNTY");
    expect(res.effects.map((e) => e.type)).toContain("SAVE_CUSTOMER_NAME");
  });
});

describe("stock handling", () => {
  it("drops out-of-stock items on confirm and shows the flag", () => {
    const c = new Convo(returning);
    const res = c.send({
      text: "• Tomatoes x 2 kg\n• Kale (Sukuma Wiki) x 3 bunch\nRef: CART-AAA1",
    });
    expect(res.replies.some((r) => /out of stock/i.test(r.kind === "text" ? r.body : r.body))).toBe(true);

    c.send({ replyId: "items_yes" });
    // Kale (unavailable) dropped, only tomatoes remain.
    expect(c.draft.items).toHaveLength(1);
    expect(c.draft.items[0].name).toBe("Tomatoes");
  });
});

describe("routing & global commands", () => {
  it("splits a mixed cart into two linked orders", () => {
    const c = new Convo(returning); // returning customer, name known
    c.send({ text: "• Tomatoes x 2 kg\n• Tomato Seedling x 10 seedling\nRef: CART-MIX1" });
    // Produce segment first; seedlings pending.
    expect(c.step).toBe("CONFIRM_ITEMS");
    expect(c.draft.mixed).toBe(true);
    expect(c.draft.path).toBe("produce");
    expect(c.draft.items.map((i) => i.name)).toEqual(["Tomatoes"]);
    expect(c.draft.pendingItems).toHaveLength(1);

    // Walk the produce delivery flow.
    c.send({ replyId: "items_yes" });
    expect(c.step).toBe("PRODUCE_ZONE");
    c.send({ replyId: "zone_z-juja" });
    c.send({ text: "Greenpark Estate" });
    c.send({ replyId: "day_today" });
    c.send({ text: "Grace, 0712345678" });
    expect(c.step).toBe("SUMMARY");

    // Confirm produce -> moves on to the seedling segment.
    c.send({ replyId: "sum_confirm" });
    expect(c.step).toBe("CONFIRM_ITEMS");
    expect(c.draft.path).toBe("seedling");
    expect(c.draft.completedSegments).toHaveLength(1);

    // Walk the seedling dispatch flow.
    c.send({ replyId: "items_yes" });
    expect(c.step).toBe("SEEDLING_COUNTY");
    c.send({ text: "Uasin Gishu" });
    c.send({ text: "Eldoret" });
    c.send({ replyId: "method_door" });
    c.send({ text: "Grace, 0712345678" });
    c.send({ text: "24 Jan" });
    expect(c.step).toBe("SUMMARY");

    // Final confirm -> create both linked orders.
    const final = c.send({ replyId: "sum_confirm" });
    expect(c.step).toBe("AWAIT_PAYMENT");
    const linked = final.effects.find((e) => e.type === "CREATE_LINKED_ORDERS");
    expect(linked).toBeTruthy();
    if (linked && linked.type === "CREATE_LINKED_ORDERS") {
      expect(linked.segments).toHaveLength(2);
      expect(linked.segments[0].origin).toBe("JUJA_HUB");
      expect(linked.segments[1].origin).toBe("ELDORET_NURSERY");
    }
  });

  it("cancels mid-flow", () => {
    const c = new Convo(returning);
    c.send({ text: CART });
    c.send({ text: "cancel" });
    expect(c.step).toBe("IDLE");
    expect(c.draft.items).toHaveLength(0);
  });

  it("opts out on stop", () => {
    const c = new Convo(returning);
    const res = c.send({ text: "stop" });
    expect(res.effects.map((e) => e.type)).toContain("OPT_OUT");
  });

  it("offers a menu for a free-text enquiry", () => {
    const c = new Convo(newCustomer);
    const res = c.send({ text: "Hi, do you sell avocado seedlings?" });
    expect(c.step).toBe("IDLE");
    expect(res.replies[0].kind).toBe("buttons");
  });

  it("asks again once, then hands over", () => {
    const c = new Convo(newCustomer);
    c.send({ text: CART });
    c.send({ replyId: "items_yes" }); // -> ASK_NAME
    c.send({ text: "Grace" }); // -> PRODUCE_ZONE
    c.send({ text: "gibberish" }); // retry 1
    expect(c.step).toBe("PRODUCE_ZONE");
    c.send({ text: "still gibberish" }); // retry 2 -> handover
    expect(c.step).toBe("HANDOVER");
  });
});

describe("payment handling", () => {
  it("records an M-Pesa code from a pasted confirmation", () => {
    const c = new Convo(returning);
    c.step = "AWAIT_PAYMENT";
    c.draft = emptyDraft();
    const res = c.send({ text: "QGH7XT9K12 Confirmed. Ksh1,540 sent to Farm City" });
    expect(res.effects.map((e) => e.type)).toContain("RECORD_MPESA_CODE");
  });

  it("marks cash on delivery", () => {
    const c = new Convo(returning);
    c.step = "AWAIT_PAYMENT";
    const res = c.send({ replyId: "pay_cod" });
    expect(res.effects.map((e) => e.type)).toContain("MARK_CASH_ON_DELIVERY");
  });
});

describe("small parsers", () => {
  it("extractMpesaCode requires letters + digits", () => {
    expect(extractMpesaCode("code QGH7XT9K12 done")).toBe("QGH7XT9K12");
    expect(extractMpesaCode("0712345678")).toBeUndefined();
    expect(extractMpesaCode("no code here")).toBeUndefined();
  });

  it("parseReceiver splits name and phone", () => {
    expect(parseReceiver("Grace, 0712345678")).toEqual({ name: "Grace", phone: "0712345678" });
    expect(parseReceiver("0722000111")).toEqual({ name: undefined, phone: "0722000111" });
  });
});
