import { ksh } from "@/lib/money";
import { parseOrderMessage } from "@/lib/cart";
import { text, buttons, list } from "@/lib/whatsapp/messages";
import type { OutboundMessage } from "@/lib/whatsapp/messages";
import { computeTotals } from "./pricing";
import type {
  Catalog,
  CatalogProduct,
  CompletedSegment,
  DraftItem,
  EngineInput,
  EngineResult,
  Effect,
  OrderDraft,
} from "./types";
import { emptyDraft } from "./types";
import type { ConversationStep } from "@/domain";
import {
  detectLanguage,
  isStopWord,
  isCancelWord,
  isChangeWord,
  isYesWord,
  t,
  type Lang,
} from "./i18n";

const MAX_RETRIES = 1; // ask again once, then hand to a human

// --- Public entry point -----------------------------------------------------

export function handleTurn(input: EngineInput): EngineResult {
  const draft: OrderDraft = clone(input.draft ?? emptyDraft());
  const said = (input.text ?? "").trim();
  const lower = said.toLowerCase();

  // Detect the customer's language (sticky to Swahili once seen) and remember it.
  const lang = detectLanguage(said, draft.lang ?? "en");
  draft.lang = lang;

  // Global commands work from any step, in English or Swahili.
  if (isStopWord(lower)) {
    return done("HANDOVER", draft, [text(t("opted_out", lang))], [{ type: "OPT_OUT" }]);
  }
  if (isCancelWord(lower) && input.step !== "IDLE" && input.step !== "DONE") {
    return done("IDLE", { ...emptyDraft(), lang }, [text(t("cancelled", lang))]);
  }

  switch (input.step) {
    case "IDLE":
    case "DONE":
      return start(input, lang);
    case "CONFIRM_ITEMS":
      return confirmItems(input, draft);
    case "ASK_NAME":
      return askName(input, draft);
    case "PRODUCE_ZONE":
      return produceZone(input, draft);
    case "PRODUCE_LOCATION":
      return produceLocation(input, draft);
    case "PRODUCE_DAY":
      return produceDay(input, draft);
    case "PRODUCE_RECEIVER":
      return produceReceiver(input, draft);
    case "SEEDLING_COUNTY":
      return seedlingCounty(input, draft);
    case "SEEDLING_TOWN":
      return seedlingTown(input, draft);
    case "SEEDLING_METHOD":
      return seedlingMethod(input, draft);
    case "SEEDLING_RECEIVER":
      return seedlingReceiver(input, draft);
    case "SEEDLING_DATE":
      return seedlingDate(input, draft);
    case "SUMMARY":
      return summaryStep(input, draft);
    case "AWAIT_PAYMENT":
      return awaitPayment(input, draft);
    case "BULK_ORG":
      return bulkOrg(input, draft);
    case "BULK_ITEMS":
      return bulkItems(input, draft);
    case "BULK_QUANTITY":
      return bulkQuantity(input, draft);
    case "BULK_LOCATION":
      return bulkLocation(input, draft);
    default:
      return start(input, lang);
  }
}

// --- Step: start ------------------------------------------------------------

function start(input: EngineInput, lang: Lang): EngineResult {
  // Enquiry-menu buttons (shown below when the message isn't an order).
  if (input.replyId === "menu_bulk") return startBulk(lang);
  if (input.replyId === "menu_produce" || input.replyId === "menu_seedlings") {
    const what = input.replyId === "menu_seedlings" ? t("what_seedlings", lang) : t("what_produce", lang);
    return {
      step: "IDLE",
      draft: { ...emptyDraft(), lang },
      replies: [text(t("send_list", lang, { what }))],
      effects: [],
    };
  }

  const parsed = parseOrderMessage(input.text ?? "");
  if (parsed.items.length === 0) {
    // Not an order — offer the enquiry menu, stay idle.
    return {
      step: "IDLE",
      draft: { ...emptyDraft(), lang },
      replies: [
        buttons(t("welcome", lang), [
          { id: "menu_produce", title: t("menu_produce", lang) },
          { id: "menu_seedlings", title: t("menu_seedlings", lang) },
          { id: "menu_bulk", title: t("menu_bulk", lang) },
        ]),
      ],
      effects: [],
    };
  }

  const draft = emptyDraft();
  draft.lang = lang;
  draft.ref = parsed.ref;
  draft.items = resolveItems(parsed.items, input.catalog);
  draft.path = detectPath(draft.items, input.catalog);
  draft.origin = draft.path === "seedling" ? "ELDORET_NURSERY" : "JUJA_HUB";
  // The storefront message may already state the name and delivery location;
  // capture them so the bot doesn't ask again.
  if (parsed.customerName) draft.customerName = parsed.customerName;
  if (parsed.deliveryLocation) draft.delivery.address = parsed.deliveryLocation;

  if (draft.path === "mixed") {
    // Split into two linked orders (Part 2.4): collect the produce first, then
    // the seedlings, then create both. Reuses the normal single-segment flow.
    const { produce, seedling } = splitBySegment(draft.items, input.catalog);
    draft.mixed = true;
    draft.items = produce;
    draft.path = "produce";
    draft.origin = "JUJA_HUB";
    draft.pendingItems = seedling;
    draft.pendingPath = "seedling";
    return {
      step: "CONFIRM_ITEMS",
      draft,
      replies: [
        text(
          "Your cart has fresh produce and seedlings — they ship from different places, so I'll set up two linked orders. Let's start with the fresh produce:",
        ),
        text(itemsSummaryText(draft)),
        confirmItemsButtons(lang),
      ],
      effects: [],
    };
  }

  const replies: OutboundMessage[] = [text(itemsSummaryText(draft)), confirmItemsButtons(lang)];
  return { step: "CONFIRM_ITEMS", draft, replies, effects: [] };
}

// --- Step: confirm items ----------------------------------------------------

function confirmItems(input: EngineInput, draft: OrderDraft): EngineResult {
  const lang = draft.lang ?? "en";
  const lower = (input.text ?? "").trim().toLowerCase();
  if (input.replyId === "items_cancel") {
    return cancelled(lang);
  }
  if (input.replyId === "items_change" || isChangeWord(lower)) {
    return {
      step: "CONFIRM_ITEMS",
      draft: { ...draft, retries: 0 },
      replies: [
        text(
          "Sure — send your full list again, one item per line, like:\n• Tomatoes x 5 kg\n• Eggs x 2 trays",
        ),
      ],
      effects: [],
    };
  }

  // A fresh list of items pasted in during the change flow.
  if (input.text) {
    const parsed = parseOrderMessage(input.text);
    if (parsed.items.length > 0) {
      const next = clone(draft);
      next.items = resolveItems(parsed.items, input.catalog);
      next.path = detectPath(next.items, input.catalog);
      next.origin = next.path === "seedling" ? "ELDORET_NURSERY" : "JUJA_HUB";
      next.retries = 0;
      return {
        step: "CONFIRM_ITEMS",
        draft: next,
        replies: [text(itemsSummaryText(next)), confirmItemsButtons(lang)],
        effects: [],
      };
    }
  }

  if (input.replyId === "items_yes" || isYesWord(lower)) {
    // Drop unavailable items now.
    const available = draft.items.filter((i) => i.available);
    if (available.length === 0) {
      return retryOrHandover(draft, "CONFIRM_ITEMS", "everything out of stock", [
        text(
          "Unfortunately none of those are in stock right now. Our team will suggest alternatives.",
        ),
      ]);
    }
    const next = clone(draft);
    next.items = available;
    next.retries = 0;
    return routeAfterItems(input, next);
  }

  return retryOrHandover(draft, "CONFIRM_ITEMS", "unrecognised at confirm", [confirmItemsButtons(lang)]);
}

function routeAfterItems(input: EngineInput, draft: OrderDraft): EngineResult {
  // We may already know the name: a returning customer, or one the storefront
  // message stated ("Name: kelly"). Only ask when we have neither.
  const lang = draft.lang ?? "en";
  const returningName = input.customer.isReturning ? input.customer.name : null;
  const knownName = returningName ?? draft.customerName ?? null;
  if (!knownName) {
    return {
      step: "ASK_NAME",
      draft,
      replies: [text(t("ask_name", lang))],
      effects: [],
    };
  }
  const next = clone(draft);
  next.customerName = knownName;
  const greeting = returningName
    ? t("greeting_back", lang, { name: knownName })
    : t("greeting_new", lang, { name: knownName });
  const res = beginDeliveryPath(input, next, greeting);
  // Persist a name that came from the message but isn't on the customer record.
  if (!input.customer.name && draft.customerName) {
    return { ...res, effects: [{ type: "SAVE_CUSTOMER_NAME", name: knownName }, ...res.effects] };
  }
  return res;
}

// --- Step: name -------------------------------------------------------------

function askName(input: EngineInput, draft: OrderDraft): EngineResult {
  const name = cleanName(input.text ?? "");
  const lang = draft.lang ?? "en";
  if (!name) {
    return retryOrHandover(draft, "ASK_NAME", "no name given", [text(t("ask_name_again", lang))]);
  }
  const next = clone(draft);
  next.customerName = name;
  next.retries = 0;
  const res = beginDeliveryPath(input, next, t("greeting_new", lang, { name }));
  return { ...res, effects: [{ type: "SAVE_CUSTOMER_NAME", name }, ...res.effects] };
}

function beginDeliveryPath(
  input: EngineInput,
  draft: OrderDraft,
  prefix: string,
): EngineResult {
  const lang = draft.lang ?? "en";
  if (draft.path === "seedling") {
    return {
      step: "SEEDLING_COUNTY",
      draft,
      replies: [text(t("ask_county", lang, { prefix }))],
      effects: [],
    };
  }
  // produce
  const zones = input.catalog.zones.filter((z) => z.type === "LOCAL");
  if (zones.length === 0) {
    return {
      step: "HANDOVER",
      draft,
      replies: [text(`${prefix}Our team will confirm delivery details with you shortly.`)],
      effects: [{ type: "HANDOVER", reason: "no local zones configured" }],
    };
  }
  const rows = zones
    .slice(0, 9)
    .map((z) => ({ id: `zone_${z.id}`, title: z.name, description: `Delivery ${ksh(z.fee)}` }));
  rows.push({ id: "zone_other", title: t("other_area", lang), description: "We'll confirm with you" });
  return {
    step: "PRODUCE_ZONE",
    draft,
    replies: [list(t("ask_where_deliver", lang, { prefix }), t("choose_area", lang), rows)],
    effects: [],
  };
}

// --- Produce path -----------------------------------------------------------

function produceZone(input: EngineInput, draft: OrderDraft): EngineResult {
  const id = input.replyId ?? "";
  if (id === "zone_other") {
    return {
      step: "HANDOVER",
      draft,
      replies: [text("Got it — our team will confirm delivery to your area and the fee.")],
      effects: [{ type: "HANDOVER", reason: "delivery zone: other area" }],
    };
  }
  const zone = input.catalog.zones.find((z) => `zone_${z.id}` === id);
  if (!zone) {
    return retryOrHandover(draft, "PRODUCE_ZONE", "zone not chosen", [
      text("Please pick your delivery area from the list."),
    ]);
  }
  const next = clone(draft);
  next.delivery = { ...next.delivery, method: "LOCAL_RIDER", zoneId: zone.id, zoneName: zone.name, fee: zone.fee };
  next.retries = 0;
  return {
    step: "PRODUCE_LOCATION",
    draft: next,
    replies: [text(t("ask_location", draft.lang ?? "en"))],
    effects: [],
  };
}

function produceLocation(input: EngineInput, draft: OrderDraft): EngineResult {
  const loc = (input.text ?? "").trim();
  if (!loc) {
    return retryOrHandover(draft, "PRODUCE_LOCATION", "no location", [
      text("I need a delivery location. Type your estate and a landmark, please."),
    ]);
  }
  const next = clone(draft);
  next.delivery = { ...next.delivery, address: loc };
  next.retries = 0;
  const lang = draft.lang ?? "en";
  const afterCutoff = isAfterCutoff(input, next.delivery.zoneId);
  const tomorrow = { id: "day_tomorrow", title: t("day_tomorrow", lang) };
  const pick = { id: "day_pick", title: t("day_pick", lang) };
  const dayButtons = afterCutoff
    ? [tomorrow, pick]
    : [{ id: "day_today", title: t("day_today", lang) }, tomorrow, pick];
  const note = afterCutoff ? "Orders after the daily cutoff are delivered the next day.\n" : "";
  return {
    step: "PRODUCE_DAY",
    draft: next,
    replies: [buttons(`${note}${t("ask_day", lang)}`, dayButtons)],
    effects: [],
  };
}

function produceDay(input: EngineInput, draft: OrderDraft): EngineResult {
  const next = clone(draft);
  const id = input.replyId ?? "";
  if (id === "day_today") next.delivery.requestedDate = "today";
  else if (id === "day_tomorrow") next.delivery.requestedDate = "tomorrow";
  else if (id === "day_pick" || input.text) next.delivery.requestedDate = input.text?.trim() || "to be confirmed";
  else {
    return retryOrHandover(draft, "PRODUCE_DAY", "no day chosen", [
      text("Please choose a delivery day."),
    ]);
  }
  if (id === "day_pick" && !input.text) {
    return { step: "PRODUCE_DAY", draft: next, replies: [text("Which date? (e.g. 24 Sep)")], effects: [] };
  }
  next.retries = 0;
  return {
    step: "PRODUCE_RECEIVER",
    draft: next,
    replies: [text(t("ask_receiver", draft.lang ?? "en"))],
    effects: [],
  };
}

function produceReceiver(input: EngineInput, draft: OrderDraft): EngineResult {
  const { name, phone } = parseReceiver(input.text ?? "");
  if (!name && !phone) {
    return retryOrHandover(draft, "PRODUCE_RECEIVER", "no receiver", [
      text("Please share the receiver's name and phone number."),
    ]);
  }
  const next = clone(draft);
  next.delivery = { ...next.delivery, receiverName: name, receiverPhone: phone };
  next.retries = 0;
  return toSummary(next);
}

// --- Seedling path ----------------------------------------------------------

function seedlingCounty(input: EngineInput, draft: OrderDraft): EngineResult {
  const county = (input.text ?? "").trim();
  if (!county) {
    return retryOrHandover(draft, "SEEDLING_COUNTY", "no county", [
      text("Which county should we dispatch to?"),
    ]);
  }
  const next = clone(draft);
  next.delivery.county = county;
  next.retries = 0;
  return { step: "SEEDLING_TOWN", draft: next, replies: [text(t("ask_town", draft.lang ?? "en"))], effects: [] };
}

function seedlingTown(input: EngineInput, draft: OrderDraft): EngineResult {
  const town = (input.text ?? "").trim();
  if (!town) {
    return retryOrHandover(draft, "SEEDLING_TOWN", "no town", [text("Please type the town or area.")]);
  }
  const next = clone(draft);
  next.delivery.town = town;
  next.retries = 0;
  return {
    step: "SEEDLING_METHOD",
    draft: next,
    replies: [
      buttons(t("ask_method", draft.lang ?? "en"), [
        { id: "method_door", title: t("method_door", draft.lang ?? "en") },
        { id: "method_office", title: t("method_office", draft.lang ?? "en") },
        { id: "method_pickup", title: t("method_pickup", draft.lang ?? "en") },
      ]),
    ],
    effects: [],
  };
}

function seedlingMethod(input: EngineInput, draft: OrderDraft): EngineResult {
  const map: Record<string, string> = {
    method_door: "COURIER",
    method_office: "BUS",
    method_pickup: "PICKUP",
  };
  const method = map[input.replyId ?? ""];
  if (!method) {
    return retryOrHandover(draft, "SEEDLING_METHOD", "no method", [
      text("Please choose a delivery method."),
    ]);
  }
  const next = clone(draft);
  next.delivery.method = method;
  next.retries = 0;
  return {
    step: "SEEDLING_RECEIVER",
    draft: next,
    replies: [text(t("ask_receiver", draft.lang ?? "en"))],
    effects: [],
  };
}

function seedlingReceiver(input: EngineInput, draft: OrderDraft): EngineResult {
  const { name, phone } = parseReceiver(input.text ?? "");
  if (!name && !phone) {
    return retryOrHandover(draft, "SEEDLING_RECEIVER", "no receiver", [
      text("Please share the receiver's name and phone number."),
    ]);
  }
  const next = clone(draft);
  next.delivery = { ...next.delivery, receiverName: name, receiverPhone: phone };
  next.retries = 0;
  return {
    step: "SEEDLING_DATE",
    draft: next,
    replies: [text("What is your preferred dispatch date? (e.g. 24 Sep)")],
    effects: [],
  };
}

function seedlingDate(input: EngineInput, draft: OrderDraft): EngineResult {
  const date = (input.text ?? "").trim();
  if (!date) {
    return retryOrHandover(draft, "SEEDLING_DATE", "no date", [
      text("Which dispatch date would you like?"),
    ]);
  }
  const next = clone(draft);
  next.delivery.requestedDate = date;
  next.retries = 0;
  return toSummary(next);
}

// --- Summary + payment ------------------------------------------------------

function summaryButtons(lang: Lang): OutboundMessage {
  return buttons(t("go_ahead", lang), [
    { id: "sum_confirm", title: t("btn_confirm_order", lang) },
    { id: "sum_edit", title: t("btn_edit", lang) },
    { id: "sum_cancel", title: t("btn_cancel", lang) },
  ]);
}

function toSummary(draft: OrderDraft): EngineResult {
  return {
    step: "SUMMARY",
    draft,
    replies: [text(summaryText(draft)), summaryButtons(draft.lang ?? "en")],
    effects: [],
  };
}

function summaryStep(input: EngineInput, draft: OrderDraft): EngineResult {
  const lang = draft.lang ?? "en";
  if (input.replyId === "sum_cancel") return cancelled(lang);
  if (input.replyId === "sum_edit") {
    return {
      step: "CONFIRM_ITEMS",
      draft: { ...draft, retries: 0 },
      replies: [
        text(itemsSummaryText(draft)),
        buttons("What would you like to do?", [
          { id: "items_yes", title: "✅ Keep items" },
          { id: "items_change", title: "✏️ Change items" },
          { id: "items_cancel", title: "❌ Cancel" },
        ]),
      ],
      effects: [],
    };
  }
  if (input.replyId === "sum_confirm") {
    // Mixed cart: another segment still to collect -> finish this one, move on.
    if (draft.pendingItems && draft.pendingItems.length > 0) {
      const seg: CompletedSegment = {
        path: draft.path === "seedling" ? "seedling" : "produce",
        origin: draft.origin ?? "JUJA_HUB",
        items: draft.items,
        delivery: draft.delivery,
      };
      const next = clone(draft);
      next.completedSegments = [...(draft.completedSegments ?? []), seg];
      next.items = draft.pendingItems;
      next.path = draft.pendingPath ?? "seedling";
      next.origin = next.path === "seedling" ? "ELDORET_NURSERY" : "JUJA_HUB";
      next.delivery = {};
      next.pendingItems = undefined;
      next.pendingPath = undefined;
      next.retries = 0;
      const label =
        next.path === "seedling" ? "seedlings (shipped from Eldoret)" : "fresh produce";
      return {
        step: "CONFIRM_ITEMS",
        draft: next,
        replies: [
          text(`✅ First order set. Now your ${label}:`),
          text(itemsSummaryText(next)),
          confirmItemsButtons(lang),
        ],
        effects: [],
      };
    }

    // Mixed cart, final segment -> create both linked orders.
    if (draft.completedSegments && draft.completedSegments.length > 0) {
      const seg: CompletedSegment = {
        path: draft.path === "seedling" ? "seedling" : "produce",
        origin: draft.origin ?? "ELDORET_NURSERY",
        items: draft.items,
        delivery: draft.delivery,
      };
      return {
        step: "AWAIT_PAYMENT",
        draft: { ...draft, retries: 0 },
        replies: [],
        effects: [
          {
            type: "CREATE_LINKED_ORDERS",
            segments: [...draft.completedSegments, seg],
            ref: draft.ref,
            customerName: draft.customerName,
          },
        ],
      };
    }

    // Single order.
    return {
      step: "AWAIT_PAYMENT",
      draft: { ...draft, retries: 0 },
      replies: [], // webhook composes the order-number + payment messages
      effects: [{ type: "CREATE_ORDER", draft }],
    };
  }
  return retryOrHandover(draft, "SUMMARY", "no summary choice", [summaryButtons(lang)]);
}

function awaitPayment(input: EngineInput, draft: OrderDraft): EngineResult {
  if (input.replyId === "pay_cod") {
    return {
      step: "DONE",
      draft,
      replies: [text("Noted — pay on delivery. We're preparing your order. \u{1F69C}")],
      effects: [{ type: "MARK_CASH_ON_DELIVERY" }],
    };
  }
  if (input.replyId === "pay_help") {
    return {
      step: "HANDOVER",
      draft,
      replies: [text("No problem — let me connect you with our team.")],
      effects: [{ type: "HANDOVER", reason: "payment help requested" }],
    };
  }
  const lang = draft.lang ?? "en";
  const code = extractMpesaCode(input.text ?? "");
  if (input.replyId === "pay_paid" || code) {
    return {
      step: "DONE",
      draft,
      replies: [
        text(
          code
            ? `Thank you! We've received code ${code} and will confirm your payment shortly.`
            : t("thanks_payment", lang),
        ),
      ],
      effects: code ? [{ type: "RECORD_MPESA_CODE", code }] : [],
    };
  }
  return retryOrHandover(draft, "AWAIT_PAYMENT", "no payment signal", [text(t("pay_prompt", lang))]);
}

// --- Bulk / institution enquiry (Part 3) ------------------------------------
// The bot gathers the same basics as the website quote form, then hands the
// conversation to a person who prepares and sends the quote.

function startBulk(lang: Lang): EngineResult {
  return {
    step: "BULK_ORG",
    draft: { ...emptyDraft(), lang, bulk: true, bulkData: {} },
    replies: [
      text(
        "\u{1F33E} We supply schools, hotels, restaurants, groceries and farms in bulk.\n\n" +
          "I'll take a few details and pass you to our team for a quote.\n\n" +
          "First — what's the name of your organisation, business or farm? (or reply *skip*)",
      ),
    ],
    effects: [],
  };
}

function bulkOrg(input: EngineInput, draft: OrderDraft): EngineResult {
  const said = (input.text ?? "").trim();
  const next = clone(draft);
  next.bulkData = { ...next.bulkData, organisation: /^skip$/i.test(said) || !said ? null : said };
  next.retries = 0;
  return {
    step: "BULK_ITEMS",
    draft: next,
    replies: [
      text("Which products do you need? List them, e.g.\n• Tomatoes\n• Sukuma wiki\n• Onions"),
    ],
    effects: [],
  };
}

function bulkItems(input: EngineInput, draft: OrderDraft): EngineResult {
  const items = (input.text ?? "").trim();
  if (!items) {
    return retryOrHandover(draft, "BULK_ITEMS", "no bulk items", [
      text("Please list the products you'd like us to quote for."),
    ]);
  }
  const next = clone(draft);
  next.bulkData = { ...next.bulkData, items };
  next.retries = 0;
  return {
    step: "BULK_QUANTITY",
    draft: next,
    replies: [
      text("Roughly how much, and how often?\ne.g. “50kg tomatoes weekly” or “200 seedlings, one-off”"),
    ],
    effects: [],
  };
}

function bulkQuantity(input: EngineInput, draft: OrderDraft): EngineResult {
  const qty = (input.text ?? "").trim();
  if (!qty) {
    return retryOrHandover(draft, "BULK_QUANTITY", "no bulk quantity", [
      text("Please give a rough quantity and how often you'll need it."),
    ]);
  }
  const next = clone(draft);
  next.bulkData = { ...next.bulkData, quantity: qty, frequency: detectFrequency(qty) };
  next.retries = 0;
  return {
    step: "BULK_LOCATION",
    draft: next,
    replies: [text("Last thing — which town and county should we deliver to?")],
    effects: [],
  };
}

function bulkLocation(input: EngineInput, draft: OrderDraft): EngineResult {
  const location = (input.text ?? "").trim();
  if (!location) {
    return retryOrHandover(draft, "BULK_LOCATION", "no bulk location", [
      text("Please share the delivery town and county."),
    ]);
  }
  const next = clone(draft);
  next.bulkData = { ...next.bulkData, location };
  next.retries = 0;
  return {
    step: "HANDOVER",
    draft: next,
    replies: [
      text(
        "Perfect — thank you! \u{1F4CB}\n\n" +
          "I've sent your bulk request to our team. They'll prepare a quote and get back to you shortly on this number.",
      ),
    ],
    effects: [{ type: "CREATE_BULK_QUOTE", draft: next }],
  };
}

function detectFrequency(t: string): string | null {
  const s = t.toLowerCase();
  if (/\bdaily|every day\b/.test(s)) return "Daily";
  if (/\bweekly|per week|a week|each week\b/.test(s)) return "Weekly";
  if (/\bbi-?weekly|fortnight/.test(s)) return "Biweekly";
  if (/\bmonthly|per month|a month|each month\b/.test(s)) return "Monthly";
  if (/\bone-?off|once\b/.test(s)) return "One-off";
  return null;
}

// --- Helpers ----------------------------------------------------------------

export function resolveItems(
  raw: { slug?: string; name: string; quantity: number; unit: string }[],
  catalog: Catalog,
): DraftItem[] {
  return raw.map((it) => {
    const match = matchProduct(it, catalog.products);
    if (match) {
      return {
        slug: match.slug,
        name: match.name,
        quantity: it.quantity,
        unit: it.unit || match.unit,
        unitPrice: match.price,
        available: match.available && match.stock >= it.quantity,
        resolved: true,
      };
    }
    return {
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: 0,
      available: false,
      resolved: false,
    };
  });
}

function matchProduct(
  it: { slug?: string; name: string },
  products: CatalogProduct[],
): CatalogProduct | undefined {
  if (it.slug) {
    const bySlug = products.find((p) => p.slug === it.slug);
    if (bySlug) return bySlug;
  }
  const name = it.name.trim().toLowerCase();
  return (
    products.find((p) => p.name.toLowerCase() === name) ??
    products.find((p) => p.name.toLowerCase().includes(name) || name.includes(p.name.toLowerCase()))
  );
}

export function detectPath(items: DraftItem[], catalog: Catalog): "produce" | "seedling" | "mixed" {
  const categories = new Set<string>();
  for (const it of items) {
    const p = catalog.products.find((x) => x.slug === it.slug);
    if (p) categories.add(p.category === "seedling" ? "seedling" : "produce");
    else categories.add(it.unit === "seedling" ? "seedling" : "produce");
  }
  if (categories.has("seedling") && categories.has("produce")) return "mixed";
  return categories.has("seedling") ? "seedling" : "produce";
}

function confirmItemsButtons(lang: Lang): OutboundMessage {
  return buttons(t("is_this_correct", lang), [
    { id: "items_yes", title: t("btn_yes_continue", lang) },
    { id: "items_change", title: t("btn_change", lang) },
    { id: "items_cancel", title: t("btn_cancel", lang) },
  ]);
}

/** Split a mixed cart's items into produce vs seedling segments. */
function splitBySegment(
  items: DraftItem[],
  catalog: Catalog,
): { produce: DraftItem[]; seedling: DraftItem[] } {
  const produce: DraftItem[] = [];
  const seedling: DraftItem[] = [];
  for (const it of items) {
    const p = catalog.products.find((x) => x.slug === it.slug);
    const isSeedling = p ? p.category === "seedling" : it.unit === "seedling";
    (isSeedling ? seedling : produce).push(it);
  }
  return { produce, seedling };
}

function itemsSummaryText(draft: OrderDraft): string {
  const lines = draft.items.map((it) => {
    const price = it.resolved ? ` — ${ksh(it.quantity * it.unitPrice)}` : "";
    const stock = it.available ? "" : it.resolved ? " (out of stock)" : " (we'll price this for you)";
    return `• ${it.name} x ${it.quantity} ${it.unit}${price}${stock}`;
  });
  const priced = draft.items.filter((i) => i.resolved && i.available);
  const subtotal = priced.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const sub = priced.length ? `\nSubtotal: ${ksh(subtotal)}` : "";
  return `\u{1F44B} Here's your order:\n${lines.join("\n")}${sub}`;
}

export function summaryText(draft: OrderDraft): string {
  const totals = computeTotals(draft.items, draft.delivery.fee ?? 0);
  const itemLines = draft.items
    .map((it) => `• ${it.name} x ${it.quantity} ${it.unit} — ${ksh(it.quantity * it.unitPrice)}`)
    .join("\n");
  const d = draft.delivery;
  const where =
    draft.path === "seedling"
      ? `${d.town ?? ""}, ${d.county ?? ""} — ${methodLabel(d.method)}`
      : `${d.zoneName ?? d.address ?? ""}${d.address ? ` (${d.address})` : ""}`;
  const when = d.requestedDate ? `\nWhen: ${d.requestedDate}` : "";
  const receiver = d.receiverName ? `\nReceiver: ${d.receiverName}${d.receiverPhone ? `, ${d.receiverPhone}` : ""}` : "";
  const discount = totals.discount > 0 ? `\nBulk discount: -${ksh(totals.discount)}` : "";
  return (
    `\u{1F9FE} Order summary\n${itemLines}\n\n` +
    `Delivery: ${where}${when}${receiver}\n` +
    `Subtotal: ${ksh(totals.subtotal)}${discount}\n` +
    `Delivery fee: ${ksh(totals.deliveryFee)}\n` +
    `Total: ${ksh(totals.total)}`
  );
}

function methodLabel(method?: string): string {
  switch (method) {
    case "COURIER":
      return "door delivery";
    case "BUS":
      return "courier/bus office";
    case "PICKUP":
      return "nursery pickup";
    case "LOCAL_RIDER":
      return "local rider";
    default:
      return "delivery";
  }
}

function retryOrHandover(
  draft: OrderDraft,
  step: ConversationStep,
  reason: string,
  replies: OutboundMessage[],
): EngineResult {
  const retries = (draft.retries ?? 0) + 1;
  if (retries > MAX_RETRIES) {
    return {
      step: "HANDOVER",
      draft: { ...draft, retries: 0 },
      replies: [text(t("handover", draft.lang ?? "en"))],
      effects: [{ type: "HANDOVER", reason }],
    };
  }
  return { step, draft: { ...draft, retries }, replies, effects: [] };
}

function cancelled(lang: Lang): EngineResult {
  return {
    step: "IDLE",
    draft: { ...emptyDraft(), lang },
    replies: [text(t("cancelled", lang))],
    effects: [],
  };
}

function done(
  step: ConversationStep,
  draft: OrderDraft,
  replies: OutboundMessage[],
  effects: Effect[] = [],
): EngineResult {
  return { step, draft, replies, effects };
}

// --- small utilities --------------------------------------------------------

export function extractMpesaCode(t: string): string | undefined {
  // Safaricom codes are 10 chars, letters+digits, usually upper-case.
  const m = t.toUpperCase().match(/\b([A-Z0-9]{10})\b/);
  if (!m) return undefined;
  // Require at least one letter and one digit to avoid matching phone numbers.
  if (!/[A-Z]/.test(m[1]) || !/[0-9]/.test(m[1])) return undefined;
  return m[1];
}

export function parseReceiver(t: string): { name?: string; phone?: string } {
  const phoneMatch = t.match(/(\+?\d[\d\s-]{7,})/);
  const phone = phoneMatch ? phoneMatch[1].replace(/[\s-]/g, "") : undefined;
  let name = t;
  if (phoneMatch) name = t.replace(phoneMatch[1], "");
  name = cleanName(name.replace(/[,;]/g, " "));
  return { name: name || undefined, phone };
}

function cleanName(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isAfterCutoff(input: EngineInput, zoneId?: string): boolean {
  const now = input.now ?? new Date();
  // Use the chosen zone's cutoff if known, else default 14:00.
  const zone = input.catalog.zones.find((z) => z.id === zoneId);
  const cutoff = zone?.cutoffTime || "14:00";
  const [h, m] = cutoff.split(":").map((x) => parseInt(x, 10));
  const cutoffMinutes = (h || 14) * 60 + (m || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= cutoffMinutes;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
