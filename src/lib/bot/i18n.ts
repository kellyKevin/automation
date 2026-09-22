// Bilingual support for the bot (Phase 2). English is the default; the bot
// switches to Swahili when it detects Swahili in the customer's messages, and
// understands common commands (yes / no / cancel / stop / change) in both.
//
// Pure and data-driven: the engine calls t(key, lang, vars) instead of hard-
// coding English, so adding a language later is just another column here.

export type Lang = "en" | "sw";

// Words that reliably signal Swahili. Kept to unambiguous, common terms so a
// stray English word never flips the language by accident.
const SWAHILI_MARKERS = [
  "habari", "mambo", "sasa", "nataka", "ninataka", "tafadhali", "ndio", "ndiyo",
  "hapana", "sawa", "asante", "bei", "tuma", "lete", "nunua", "oda", "samahani",
  "ghairi", "acha", "simama", "badilisha", "jina", "wapi", "lini", "malipo",
  "lipa", "pesa", "shukrani", "karibu", "mboga", "miche", "nun. ",
];

/** Detect the language of a message. Sticky to Swahili: once a customer writes
 * Swahili we keep replying in Swahili unless the fallback says otherwise. */
export function detectLanguage(text: string | undefined, fallback: Lang = "en"): Lang {
  const s = (text ?? "").toLowerCase();
  if (!s.trim()) return fallback;
  const hit = SWAHILI_MARKERS.some((w) => new RegExp(`\\b${w.trim()}\\b`).test(s));
  return hit ? "sw" : fallback;
}

// --- Command understanding (both languages) --------------------------------

export function isStopWord(lower: string): boolean {
  return /^(stop|unsubscribe|opt ?out|acha|simama|sitisha|ondoa)\b/.test(lower);
}
export function isCancelWord(lower: string): boolean {
  return /^(cancel|abort|ghairi|sitaki|batili)\b/.test(lower);
}
export function isChangeWord(lower: string): boolean {
  return /^(change|edit|amend|badilisha|rekebisha)\b/.test(lower);
}
/** An affirmative reply ("yes" / "ndio" / "sawa"). */
export function isYesWord(lower: string): boolean {
  return /^(yes|yeah|yep|sure|ok(ay)?|ndio|ndiyo|sawa|haya|poa)\b/.test(lower);
}

// --- Message catalogue ------------------------------------------------------

type Vars = Record<string, string | number>;
type Entry = { en: string; sw: string };

const CATALOG: Record<string, Entry> = {
  welcome: {
    en: "\u{1F44B} Welcome to Farm City! What can I help you with?",
    sw: "\u{1F44B} Karibu Farm City! Nikusaidie na nini?",
  },
  menu_produce: { en: "Fresh produce", sw: "Mazao mabichi" },
  menu_seedlings: { en: "Seedlings", sw: "Miche" },
  menu_bulk: { en: "Bulk / institution", sw: "Jumla / taasisi" },
  send_list: {
    en: "Great! Send me your {what} list, one item per line, e.g.\n• Tomatoes x 5 kg\n• Onions x 2 kg\n\nI'll price it and set up your order.",
    sw: "Vizuri! Nitumie orodha yako ya {what}, kitu kimoja kila mstari, mfano:\n• Nyanya x 5 kg\n• Vitunguu x 2 kg\n\nNitaweka bei na kuandaa oda yako.",
  },
  what_produce: { en: "fresh produce", sw: "mazao mabichi" },
  what_seedlings: { en: "seedlings", sw: "miche" },
  is_this_correct: { en: "Is this correct?", sw: "Je, hii ni sahihi?" },
  btn_yes_continue: { en: "✅ Yes, continue", sw: "✅ Ndio, endelea" },
  btn_change: { en: "✏️ Change items", sw: "✏️ Badilisha" },
  btn_cancel: { en: "❌ Cancel", sw: "❌ Ghairi" },
  ask_name: { en: "May I have your name for the order?", sw: "Naomba jina lako kwa oda hii?" },
  ask_name_again: {
    en: "Sorry, I didn't catch that. What name should we put on the order?",
    sw: "Samahani, sikupata. Tuweke jina gani kwenye oda?",
  },
  greeting_new: { en: "Thanks, {name}! ", sw: "Asante, {name}! " },
  greeting_back: { en: "Welcome back, {name}! ", sw: "Karibu tena, {name}! " },
  ask_where_deliver: { en: "{prefix}Where should we deliver?", sw: "{prefix}Tupeleke wapi?" },
  choose_area: { en: "Choose area", sw: "Chagua eneo" },
  other_area: { en: "Other area", sw: "Eneo lingine" },
  ask_location: {
    en: "Please share your location pin, or type your estate and a nearby landmark.",
    sw: "Tafadhali tuma lokesheni yako, au andika mtaa wako na alama ya karibu.",
  },
  ask_day: { en: "When would you like delivery?", sw: "Ungependa uletewe lini?" },
  day_today: { en: "Today", sw: "Leo" },
  day_tomorrow: { en: "Tomorrow", sw: "Kesho" },
  day_pick: { en: "Pick a date", sw: "Chagua tarehe" },
  ask_receiver: {
    en: "Who will receive the order, and on which phone number?\n(e.g. Grace, 0712345678)",
    sw: "Nani atapokea oda, na kwa namba gani ya simu?\n(mfano: Grace, 0712345678)",
  },
  ask_county: { en: "{prefix}Which county are we sending the seedlings to?", sw: "{prefix}Tunapeleka miche kaunti gani?" },
  ask_town: { en: "Which town or area?", sw: "Mji au eneo gani?" },
  ask_method: { en: "How would you like to receive them?", sw: "Ungependa kuzipokeaje?" },
  method_door: { en: "Door delivery", sw: "Kufikishwa mlangoni" },
  method_office: { en: "Courier/bus office", sw: "Ofisi ya basi/kampuni" },
  method_pickup: { en: "Pick up at nursery", sw: "Kuchukua kitaluni" },
  ask_dispatch_date: { en: "What is your preferred dispatch date? (e.g. 24 Sep)", sw: "Ungependa kutumiwa tarehe gani? (mfano: 24 Sep)" },
  go_ahead: { en: "Shall we go ahead?", sw: "Tuendelee?" },
  btn_confirm_order: { en: "✅ Confirm order", sw: "✅ Thibitisha oda" },
  btn_edit: { en: "✏️ Edit", sw: "✏️ Hariri" },
  cancelled: {
    en: "Order cancelled. Send a new order whenever you're ready. \u{1F331}",
    sw: "Oda imeghairiwa. Tuma oda mpya wakati wowote. \u{1F331}",
  },
  opted_out: {
    en: "You're unsubscribed from non-order messages. Send a new order any time to start again.",
    sw: "Umejiondoa kwenye ujumbe usio wa oda. Tuma oda wakati wowote kuanza tena.",
  },
  handover: {
    en: "Let me connect you with our team, who'll help you from here.",
    sw: "Nitakuunganisha na timu yetu, watakusaidia kuanzia hapa.",
  },
  pay_prompt: {
    en: "Once you've paid, reply with the M-Pesa confirmation message, or tap an option above.",
    sw: "Ukishalipa, jibu na ujumbe wa uthibitisho wa M-Pesa, au bofya chaguo hapo juu.",
  },
  thanks_payment: {
    en: "Thank you! We'll confirm your payment shortly.",
    sw: "Asante! Tutathibitisha malipo yako hivi punde.",
  },
  // --- Order confirmation & payment (composed after an order is created) ---
  oc_received: {
    en: "✅ Order {number} received. We'll confirm stock shortly.",
    sw: "✅ Oda {number} imepokelewa. Tutathibitisha stoku hivi punde.",
  },
  oc_pay: {
    en: "To complete your order, pay {amount} via M-Pesa:\nPaybill: {paybill}\nAccount: {account}\n\nReply here with the M-Pesa confirmation message once done.",
    sw: "Kukamilisha oda yako, lipa {amount} kupitia M-Pesa:\nPaybill: {paybill}\nAkaunti: {account}\n\nJibu hapa na ujumbe wa uthibitisho wa M-Pesa ukimaliza.",
  },
  btn_paid: { en: "\u{1F4B3} I've paid", sw: "\u{1F4B3} Nimelipa" },
  btn_cod: { en: "\u{1F4B5} Pay on delivery", sw: "\u{1F4B5} Lipa nikipokea" },
  btn_help: { en: "❓ Need help", sw: "❓ Nahitaji msaada" },
  cod_noted: {
    en: "Noted — pay on delivery. We're preparing your order. \u{1F69C}",
    sw: "Sawa — utalipa unapopokea. Tunaandaa oda yako. \u{1F69C}",
  },
  pay_help_connect: {
    en: "No problem — let me connect you with our team.",
    sw: "Hakuna shida — nitakuunganisha na timu yetu.",
  },
  thanks_code: {
    en: "Thank you! We've received code {code} and will confirm your payment shortly.",
    sw: "Asante! Tumepokea msimbo {code} na tutathibitisha malipo yako hivi punde.",
  },
  linked_intro: {
    en: "✅ Your cart ships from two places, so I've created {n} linked orders:",
    sw: "✅ Bidhaa zako zinatoka sehemu mbili, kwa hivyo nimeunda oda {n} zilizounganishwa:",
  },
  linked_pay: {
    en: "To complete both orders, pay {amount} via M-Pesa:\nPaybill: {paybill}\nUse reference {refs}.\n\nReply here with the M-Pesa confirmation once done.",
    sw: "Kukamilisha oda zote mbili, lipa {amount} kupitia M-Pesa:\nPaybill: {paybill}\nTumia rejeleo {refs}.\n\nJibu hapa na uthibitisho wa M-Pesa ukimaliza.",
  },
  linked_line_produce: { en: "Fresh produce", sw: "Mazao mabichi" },
  linked_line_seedlings: { en: "Seedlings", sw: "Miche" },
};

/** Translate a catalogue key into the given language, filling {vars}. */
export function t(key: keyof typeof CATALOG, lang: Lang, vars?: Vars): string {
  const entry = CATALOG[key];
  let out = entry ? entry[lang] : String(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}
