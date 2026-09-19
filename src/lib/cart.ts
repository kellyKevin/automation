// The cart handoff: how the website turns a cart into a WhatsApp message, and
// how the bot reads that message back. The format is deliberately simple and
// stable so the parser is reliable.
//
//   Hello Farm City, I'd like to order:
//   • Tomatoes x 5 kg
//   • Eggs x 2 trays
//   Ref: CART-8F3K

export interface CartItem {
  /** Product slug, when the item came from a known catalogue product. */
  slug?: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface ParsedOrder {
  items: CartItem[];
  ref?: string;
}

const GREETING = "Hello Farm City, I'd like to order:";

/** Generate a short, human-friendly cart reference, e.g. CART-8F3K. */
export function generateCartRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `CART-${out}`;
}

/** Build the pre-filled WhatsApp message body for a cart. */
export function formatOrderMessage(items: CartItem[], ref: string): string {
  const lines = items.map(
    (it) => `• ${it.name} x ${it.quantity} ${it.unit}`.trimEnd(),
  );
  return [GREETING, ...lines, `Ref: ${ref}`].join("\n");
}

/** Build a wa.me deep link that opens WhatsApp with the message pre-filled. */
export function buildWhatsAppLink(
  businessNumber: string,
  message: string,
): string {
  const number = businessNumber.replace(/[^\d]/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** Convenience: cart -> full wa.me link in one call. */
export function buildOrderLink(
  businessNumber: string,
  items: CartItem[],
  ref: string,
): string {
  return buildWhatsAppLink(businessNumber, formatOrderMessage(items, ref));
}

const REF_RE = /ref\s*[:#-]?\s*(CART-[A-Z0-9]{3,})/i;

// A line item like:  • Tomatoes x 5 kg   /   - Eggs × 2 trays   /   Kale * 3 bunches
// Also tolerates:    Tomatoes - 5 kg     /   5 kg tomatoes  (qty first)
const ITEM_BULLET_RE =
  /^[\s>*\-•–—]*(.+?)\s*(?:x|×|\*|-)\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s*$/i;
const ITEM_QTYFIRST_RE =
  /^[\s>*\-•–—]*(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+(?:of\s+)?(.+?)\s*$/i;

/**
 * Parse an incoming WhatsApp order message into items + optional ref.
 * Returns items === [] when the message doesn't look like an order at all
 * (so the caller can route it to the enquiry / free-text path).
 */
export function parseOrderMessage(text: string): ParsedOrder {
  const refMatch = text.match(REF_RE);
  const ref = refMatch ? refMatch[1].toUpperCase() : undefined;

  const items: CartItem[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^ref\b/i.test(line)) continue;
    if (/i'?d like to order/i.test(line) || /^hello\b/i.test(line)) continue;

    const bullet = line.match(ITEM_BULLET_RE);
    if (bullet) {
      const name = cleanName(bullet[1]);
      const quantity = parseFloat(bullet[2]);
      const unit = (bullet[3] || "unit").toLowerCase();
      if (name && quantity > 0) {
        items.push({ name, quantity, unit });
        continue;
      }
    }

    const qtyFirst = line.match(ITEM_QTYFIRST_RE);
    if (qtyFirst) {
      const quantity = parseFloat(qtyFirst[1]);
      const unit = qtyFirst[2].toLowerCase();
      const name = cleanName(qtyFirst[3]);
      if (name && quantity > 0) {
        items.push({ name, quantity, unit });
      }
    }
  }

  return { items, ref };
}

function cleanName(raw: string): string {
  return raw
    .replace(/[,:;]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}
