import { ksh } from "@/lib/money";
import { parseOrderMessage } from "@/lib/cart";
import { text, buttons, list } from "@/lib/whatsapp/messages";
import type { OutboundMessage } from "@/lib/whatsapp/messages";
import { computeTotals } from "./pricing";
import type {
  Catalog,
  CatalogProduct,
  DraftItem,
  EngineInput,
  EngineResult,
  Effect,
  OrderDraft,
} from "./types";
import { emptyDraft } from "./types";
import type { ConversationStep } from "@/domain";

const MAX_RETRIES = 1; // ask again once, then hand to a human

// --- Public entry point -----------------------------------------------------

export function handleTurn(input: EngineInput): EngineResult {
  const draft: OrderDraft = clone(input.draft ?? emptyDraft());
  const said = (input.text ?? "").trim();
  const lower = said.toLowerCase();

  // Global commands work from any step.
  if (isStop(lower)) {
    return done("HANDOVER", draft, [
      text(
        "You're unsubscribed from non-order messages. Send a new order any time to start again.",
      ),
    ], [{ type: "OPT_OUT" }]);
  }
  if (isCancel(lower) && input.step !== "IDLE" && input.step !== "DONE") {
    return done("IDLE", emptyDraft(), [
      text("No problem — I've cancelled that. Send a new order whenever you're ready. \u{1F331}"),
    ]);
  }

  switch (input.step) {
    case "IDLE":
    case "DONE":
      return start(input);
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
    default:
      return start(input);
  }
}

// --- Step: start ------------------------------------------------------------

function start(input: EngineInput): EngineResult {
  const parsed = parseOrderMessage(input.text ?? "");
  if (parsed.items.length === 0) {
    // Not an order — offer the enquiry menu, stay idle.
    return {
      step: "IDLE",
      draft: emptyDraft(),
      replies: [
        buttons(
          "\u{1F44B} Welcome to Farm City! What can I help you with?",
          [
            { id: "menu_produce", title: "Fresh produce" },
            { id: "menu_seedlings", title: "Seedlings" },
            { id: "menu_bulk", title: "Bulk / institution" },
          ],
        ),
      ],
      effects: [],
    };
  }

  const draft = emptyDraft();
  draft.ref = parsed.ref;
  draft.items = resolveItems(parsed.items, input.catalog);
  draft.path = detectPath(draft.items, input.catalog);
  draft.origin = draft.path === "seedling" ? "ELDORET_NURSERY" : "JUJA_HUB";
  // The storefront message may already state the name and delivery location;
  // capture them so the bot doesn't ask again.
  if (parsed.customerName) draft.customerName = parsed.customerName;
  if (parsed.deliveryLocation) draft.delivery.address = parsed.deliveryLocation;

  if (draft.path === "mixed") {
    return {
      step: "HANDOVER",
      draft,
      replies: [
        text(
          "Your cart mixes fresh produce and seedlings, which ship from different places (Juja & Eldoret). Our team will split this into two orders and get back to you shortly.",
        ),
      ],
      effects: [{ type: "HANDOVER", reason: "mixed cart" }],
    };
  }

  const replies: OutboundMessage[] = [text(itemsSummaryText(draft))];
  replies.push(
    buttons("Is this correct?", [
      { id: "items_yes", title: "✅ Yes, continue" },
      { id: "items_change", title: "✏️ Change items" },
      { id: "items_cancel", title: "❌ Cancel" },
    ]),
  );
  return { step: "CONFIRM_ITEMS", draft, replies, effects: [] };
}

// --- Step: confirm items ----------------------------------------------------

function confirmItems(input: EngineInput, draft: OrderDraft): EngineResult {
  if (input.replyId === "items_cancel") {
    return cancelled();
  }
  if (input.replyId === "items_change" || wantsChange(input.text)) {
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
        replies: [
          text(itemsSummaryText(next)),
          buttons("Is this correct?", [
            { id: "items_yes", title: "✅ Yes, continue" },
            { id: "items_change", title: "✏️ Change items" },
            { id: "items_cancel", title: "❌ Cancel" },
          ]),
        ],
        effects: [],
      };
    }
  }

  if (input.replyId === "items_yes") {
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

  return retryOrHandover(draft, "CONFIRM_ITEMS", "unrecognised at confirm", [
    buttons("Please choose one:", [
      { id: "items_yes", title: "✅ Yes, continue" },
      { id: "items_change", title: "✏️ Change items" },
      { id: "items_cancel", title: "❌ Cancel" },
    ]),
  ]);
}

function routeAfterItems(input: EngineInput, draft: OrderDraft): EngineResult {
  // We may already know the name: a returning customer, or one the storefront
  // message stated ("Name: kelly"). Only ask when we have neither.
  const returningName = input.customer.isReturning ? input.customer.name : null;
  const knownName = returningName ?? draft.customerName ?? null;
  if (!knownName) {
    return {
      step: "ASK_NAME",
      draft,
      replies: [text("May I have your name for the order?")],
      effects: [],
    };
  }
  const next = clone(draft);
  next.customerName = knownName;
  const greeting = returningName ? `Welcome back, ${knownName}! ` : `Thanks, ${knownName}! `;
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
  if (!name) {
    return retryOrHandover(draft, "ASK_NAME", "no name given", [
      text("Sorry, I didn't catch that. What name should we put on the order?"),
    ]);
  }
  const next = clone(draft);
  next.customerName = name;
  next.retries = 0;
  const res = beginDeliveryPath(input, next, `Thanks, ${name}! `);
  return { ...res, effects: [{ type: "SAVE_CUSTOMER_NAME", name }, ...res.effects] };
}

function beginDeliveryPath(
  input: EngineInput,
  draft: OrderDraft,
  prefix: string,
): EngineResult {
  if (draft.path === "seedling") {
    return {
      step: "SEEDLING_COUNTY",
      draft,
      replies: [text(`${prefix}Which county are we sending the seedlings to?`)],
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
  rows.push({ id: "zone_other", title: "Other area", description: "We'll confirm with you" });
  return {
    step: "PRODUCE_ZONE",
    draft,
    replies: [list(`${prefix}Where should we deliver?`, "Choose area", rows)],
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
    replies: [
      text("Please share your location pin, or type your estate and a nearby landmark."),
    ],
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
  const afterCutoff = isAfterCutoff(input, next.delivery.zoneId);
  const dayButtons = afterCutoff
    ? [
        { id: "day_tomorrow", title: "Tomorrow" },
        { id: "day_pick", title: "Pick a date" },
      ]
    : [
        { id: "day_today", title: "Today" },
        { id: "day_tomorrow", title: "Tomorrow" },
        { id: "day_pick", title: "Pick a date" },
      ];
  const note = afterCutoff ? "Orders after the daily cutoff are delivered the next day.\n" : "";
  return {
    step: "PRODUCE_DAY",
    draft: next,
    replies: [buttons(`${note}When would you like delivery?`, dayButtons)],
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
    replies: [text("Who will receive the order, and on which phone number?\n(e.g. Grace, 0712345678)")],
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
  return { step: "SEEDLING_TOWN", draft: next, replies: [text("Which town or area?")], effects: [] };
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
      buttons("How would you like to receive them?", [
        { id: "method_door", title: "Door delivery" },
        { id: "method_office", title: "Courier/bus office" },
        { id: "method_pickup", title: "Pick up at nursery" },
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
    replies: [text("Receiver's name and phone number, please.\n(e.g. Grace, 0712345678)")],
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

function toSummary(draft: OrderDraft): EngineResult {
  return {
    step: "SUMMARY",
    draft,
    replies: [
      text(summaryText(draft)),
      buttons("Shall we go ahead?", [
        { id: "sum_confirm", title: "✅ Confirm order" },
        { id: "sum_edit", title: "✏️ Edit" },
        { id: "sum_cancel", title: "❌ Cancel" },
      ]),
    ],
    effects: [],
  };
}

function summaryStep(input: EngineInput, draft: OrderDraft): EngineResult {
  if (input.replyId === "sum_cancel") return cancelled();
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
    return {
      step: "AWAIT_PAYMENT",
      draft: { ...draft, retries: 0 },
      replies: [], // webhook composes the order-number + payment messages
      effects: [{ type: "CREATE_ORDER", draft }],
    };
  }
  return retryOrHandover(draft, "SUMMARY", "no summary choice", [
    buttons("Please choose:", [
      { id: "sum_confirm", title: "✅ Confirm order" },
      { id: "sum_edit", title: "✏️ Edit" },
      { id: "sum_cancel", title: "❌ Cancel" },
    ]),
  ]);
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
  const code = extractMpesaCode(input.text ?? "");
  if (input.replyId === "pay_paid" || code) {
    return {
      step: "DONE",
      draft,
      replies: [
        text(
          code
            ? `Thank you! We've received code ${code} and will confirm your payment shortly.`
            : "Thank you! We'll confirm your payment shortly.",
        ),
      ],
      effects: code ? [{ type: "RECORD_MPESA_CODE", code }] : [],
    };
  }
  return retryOrHandover(draft, "AWAIT_PAYMENT", "no payment signal", [
    text("Once you've paid, reply with the M-Pesa confirmation message, or tap an option above."),
  ]);
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
      replies: [text("Let me connect you with our team, who'll help you from here.")],
      effects: [{ type: "HANDOVER", reason }],
    };
  }
  return { step, draft: { ...draft, retries }, replies, effects: [] };
}

function cancelled(): EngineResult {
  return {
    step: "IDLE",
    draft: emptyDraft(),
    replies: [text("Order cancelled. Send a new order whenever you're ready. \u{1F331}")],
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

function isStop(lower: string): boolean {
  return /^(stop|unsubscribe|opt ?out)\b/.test(lower);
}
function isCancel(lower: string): boolean {
  return /^(cancel|abort)\b/.test(lower);
}
function wantsChange(t?: string): boolean {
  return !!t && /^(change|edit|amend)\b/i.test(t.trim());
}

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
