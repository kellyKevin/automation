import { describe, it, expect } from "vitest";
import { handleTurn } from "./engine";
import { emptyDraft } from "./types";
import type { Catalog, EngineInput, OrderDraft } from "./types";
import type { ConversationStep } from "@/domain";
import { isWindowOpen, WINDOW_MS } from "@/lib/whatsapp/window";
import { chooseOutbound } from "@/lib/messaging/deliver";
import { templateForStatus } from "@/lib/whatsapp/templates";

// A small catalogue: one produce item (Juja) and one seedling (Eldoret).
const catalog: Catalog = {
  products: [
    { slug: "tomatoes", name: "Tomatoes", category: "produce", unit: "kg", price: 100, available: true, stock: 100, origin: "JUJA_HUB" },
    { slug: "hass-seedling", name: "Hass Avocado Seedling", category: "seedling", unit: "seedling", price: 150, available: true, stock: 50, origin: "ELDORET_NURSERY" },
    { slug: "kale", name: "Kale", category: "produce", unit: "bunch", price: 40, available: false, stock: 0, origin: "JUJA_HUB" },
  ],
  zones: [{ id: "juja", name: "Juja", type: "LOCAL", fee: 200, minimumOrder: 0, cutoffTime: "14:00" }],
};

const morning = new Date("2026-09-22T09:00:00");

function turn(
  step: ConversationStep,
  draft: OrderDraft,
  msg: { text?: string; replyId?: string },
  opts: { returning?: boolean; name?: string | null } = {},
) {
  const input: EngineInput = {
    step,
    draft,
    customer: { isReturning: opts.returning ?? false, name: opts.name ?? null },
    catalog,
    text: msg.text,
    replyId: msg.replyId,
    now: morning,
  };
  return handleTurn(input);
}

const order = (lines: string[]) => `Hello Farm City, I'd like to order:\n${lines.join("\n")}\nRef: CART-AB12`;

describe("scenario: single produce order end to end", () => {
  it("greets, confirms, collects delivery, and emits CREATE_ORDER", () => {
    let r = turn("IDLE", emptyDraft(), { text: order(["• Tomatoes x 5 kg"]) });
    expect(r.step).toBe("CONFIRM_ITEMS");
    expect(r.draft.items).toHaveLength(1);
    expect(r.draft.path).toBe("produce");

    r = turn(r.step, r.draft, { replyId: "items_yes" });
    expect(r.step).toBe("ASK_NAME");

    r = turn(r.step, r.draft, { text: "Grace" });
    expect(r.step).toBe("PRODUCE_ZONE");
    expect(r.effects).toContainEqual({ type: "SAVE_CUSTOMER_NAME", name: "Grace" });

    r = turn(r.step, r.draft, { replyId: "zone_juja" });
    expect(r.step).toBe("PRODUCE_LOCATION");

    r = turn(r.step, r.draft, { text: "Juja estate, near the church" });
    expect(r.step).toBe("PRODUCE_DAY");

    r = turn(r.step, r.draft, { replyId: "day_today" });
    expect(r.step).toBe("PRODUCE_RECEIVER");

    r = turn(r.step, r.draft, { text: "Grace, 0712345678" });
    expect(r.step).toBe("SUMMARY");

    r = turn(r.step, r.draft, { replyId: "sum_confirm" });
    expect(r.step).toBe("AWAIT_PAYMENT");
    expect(r.effects).toEqual([{ type: "CREATE_ORDER", draft: expect.any(Object) }]);
  });
});

describe("scenario: mixed cart splits into two linked orders", () => {
  it("collects produce then seedlings and emits CREATE_LINKED_ORDERS", () => {
    let r = turn("IDLE", emptyDraft(), {
      text: order(["• Tomatoes x 5 kg", "• Hass Avocado Seedling x 3 seedling"]),
    });
    // Starts on the produce segment, with the seedlings pending.
    expect(r.step).toBe("CONFIRM_ITEMS");
    expect(r.draft.mixed).toBe(true);
    expect(r.draft.path).toBe("produce");
    expect(r.draft.pendingItems).toHaveLength(1);

    // Produce segment.
    r = turn(r.step, r.draft, { replyId: "items_yes" });
    expect(r.step).toBe("ASK_NAME");
    r = turn(r.step, r.draft, { text: "Grace" });
    expect(r.step).toBe("PRODUCE_ZONE");
    r = turn(r.step, r.draft, { replyId: "zone_juja" });
    r = turn(r.step, r.draft, { text: "Juja estate" });
    r = turn(r.step, r.draft, { replyId: "day_today" });
    r = turn(r.step, r.draft, { text: "Grace, 0712345678" });
    expect(r.step).toBe("SUMMARY");

    // Confirming the first segment moves on to the seedlings.
    r = turn(r.step, r.draft, { replyId: "sum_confirm" });
    expect(r.step).toBe("CONFIRM_ITEMS");
    expect(r.draft.path).toBe("seedling");

    // Seedling segment — the name is already known, so no ASK_NAME.
    r = turn(r.step, r.draft, { replyId: "items_yes" });
    expect(r.step).toBe("SEEDLING_COUNTY");
    r = turn(r.step, r.draft, { text: "Uasin Gishu" });
    expect(r.step).toBe("SEEDLING_TOWN");
    r = turn(r.step, r.draft, { text: "Eldoret" });
    expect(r.step).toBe("SEEDLING_METHOD");
    r = turn(r.step, r.draft, { replyId: "method_door" });
    expect(r.step).toBe("SEEDLING_RECEIVER");
    r = turn(r.step, r.draft, { text: "Grace, 0712345678" });
    expect(r.step).toBe("SEEDLING_DATE");
    r = turn(r.step, r.draft, { text: "24 Sep" });
    expect(r.step).toBe("SUMMARY");

    r = turn(r.step, r.draft, { replyId: "sum_confirm" });
    expect(r.step).toBe("AWAIT_PAYMENT");
    const effect = r.effects[0];
    expect(effect.type).toBe("CREATE_LINKED_ORDERS");
    if (effect.type === "CREATE_LINKED_ORDERS") {
      expect(effect.segments).toHaveLength(2);
      expect(effect.segments.map((s) => s.path).sort()).toEqual(["produce", "seedling"]);
    }
  });
});

describe("scenario: side paths", () => {
  it("drops an out-of-stock item and proceeds with what's available", () => {
    let r = turn("IDLE", emptyDraft(), { text: order(["• Tomatoes x 2 kg", "• Kale x 3 bunch"]) });
    expect(r.step).toBe("CONFIRM_ITEMS");
    r = turn(r.step, r.draft, { replyId: "items_yes" });
    expect(r.step).toBe("ASK_NAME");
    expect(r.draft.items.map((i) => i.name)).toEqual(["Tomatoes"]);
  });

  it("hands over when everything is out of stock", () => {
    const kaleOnly = order(["• Kale x 3 bunch"]);
    let r = turn("IDLE", emptyDraft(), { text: kaleOnly });
    r = turn(r.step, r.draft, { replyId: "items_yes" }); // retry 1
    expect(r.step).toBe("CONFIRM_ITEMS");
    r = turn(r.step, r.draft, { replyId: "items_yes" }); // retry 2 -> handover
    expect(r.step).toBe("HANDOVER");
  });

  it("cancels mid-flow", () => {
    const r = turn("ASK_NAME", { ...emptyDraft(), path: "produce" }, { text: "cancel" });
    expect(r.step).toBe("IDLE");
    expect(r.draft.items).toHaveLength(0);
  });

  it("opts out on STOP", () => {
    const r = turn("PRODUCE_ZONE", emptyDraft(), { text: "STOP" });
    expect(r.effects).toContainEqual({ type: "OPT_OUT" });
  });

  it("re-asks then hands over on repeated unclear input", () => {
    const draft = { ...emptyDraft(), path: "produce" as const };
    const retry = turn("ASK_NAME", draft, { text: "" });
    expect(retry.step).toBe("ASK_NAME");
    const giveUp = turn("ASK_NAME", retry.draft, { text: "" });
    expect(giveUp.step).toBe("HANDOVER");
    expect(giveUp.effects).toContainEqual({ type: "HANDOVER", reason: expect.any(String) });
  });

  it("welcomes back a returning customer without asking their name", () => {
    let r = turn("IDLE", emptyDraft(), { text: order(["• Tomatoes x 1 kg"]) }, { returning: true, name: "Otieno" });
    r = turn(r.step, r.draft, { replyId: "items_yes" }, { returning: true, name: "Otieno" });
    expect(r.step).toBe("PRODUCE_ZONE");
    expect(r.draft.customerName).toBe("Otieno");
  });
});

describe("scenario: Swahili / mixed-language", () => {
  it("greets in Swahili when the customer writes Swahili", () => {
    const r = turn("IDLE", emptyDraft(), { text: "Habari, nataka mboga" });
    expect(r.step).toBe("IDLE");
    expect(r.draft.lang).toBe("sw");
    expect(r.replies[0].body).toContain("Karibu");
  });

  it("understands a Swahili 'yes' at item confirmation and replies in Swahili", () => {
    const start = turn("IDLE", emptyDraft(), { text: order(["• Tomatoes x 2 kg"]) });
    const r = turn("CONFIRM_ITEMS", start.draft, { text: "ndio" });
    expect(r.step).toBe("ASK_NAME");
    expect(r.draft.lang).toBe("sw");
    expect(r.replies[0].body).toContain("jina"); // "Naomba jina lako…"
  });

  it("cancels on the Swahili command 'ghairi'", () => {
    const r = turn("ASK_NAME", { ...emptyDraft(), lang: "sw", path: "produce" }, { text: "ghairi" });
    expect(r.step).toBe("IDLE");
    expect(r.replies[0].body).toContain("imeghairiwa");
  });
});

describe("scenario: 24-hour window expiry decides free-form vs template vs queue", () => {
  const now = new Date("2026-09-22T12:00:00Z");

  it("sends free-form just inside the window", () => {
    const lastInbound = new Date(now.getTime() - (WINDOW_MS - 60_000));
    expect(isWindowOpen(lastInbound, now)).toBe(true);
    expect(chooseOutbound({ windowOpen: true, hasTemplate: true })).toBe("free_form");
  });

  it("uses a template just outside the window when one applies", () => {
    const lastInbound = new Date(now.getTime() - (WINDOW_MS + 60_000));
    expect(isWindowOpen(lastInbound, now)).toBe(false);
    const tmpl = templateForStatus("PAID", { orderNumber: "FC-1" });
    expect(chooseOutbound({ windowOpen: false, hasTemplate: !!tmpl })).toBe("template");
  });

  it("queues outside the window when no template applies", () => {
    const tmpl = templateForStatus("ON_HOLD", { orderNumber: "FC-1" });
    expect(tmpl).toBeNull();
    expect(chooseOutbound({ windowOpen: false, hasTemplate: !!tmpl })).toBe("queue");
  });
});
