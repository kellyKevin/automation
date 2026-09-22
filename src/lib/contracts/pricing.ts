// Contract price lists + invoice maths (Phase 2). Pure so it is easy to test.

export interface PricedItem {
  slug?: string | null;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface ContractPriceRow {
  slug: string | null;
  productName: string;
  unitPrice: number;
}

/** Build a lookup from a contract's price list. Keyed by slug (preferred) and
 * by lower-cased product name, so items match either way. */
export function priceIndex(rows: ContractPriceRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.slug) map.set(`slug:${r.slug}`, r.unitPrice);
    map.set(`name:${r.productName.toLowerCase()}`, r.unitPrice);
  }
  return map;
}

/** Apply a contract's agreed prices to a set of items, overriding the unit
 * price where the price list has one. Items not on the list keep their price. */
export function applyContractPrices<T extends PricedItem>(items: T[], index: Map<string, number>): T[] {
  return items.map((it) => {
    const bySlug = it.slug ? index.get(`slug:${it.slug}`) : undefined;
    const byName = index.get(`name:${it.name.toLowerCase()}`);
    const price = bySlug ?? byName;
    return price === undefined ? it : { ...it, unitPrice: price };
  });
}

// --- Invoices ---------------------------------------------------------------

export const INVOICE_NUMBER_PREFIX = "INV";

export function formatInvoiceNumber(seq: number, prefix = INVOICE_NUMBER_PREFIX): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`Invalid invoice sequence: ${seq}`);
  return `${prefix}-${seq.toString().padStart(4, "0")}`;
}

export interface InvoiceSourceOrder {
  id: string;
  number: string;
  total: number;
}

export interface InvoiceLineDraft {
  orderId: string | null;
  orderNumber: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** One invoice line per order (the order's total). Simple and reconcilable —
 * each line points back at a specific order number. */
export function buildInvoiceLines(orders: InvoiceSourceOrder[]): InvoiceLineDraft[] {
  return orders.map((o) => ({
    orderId: o.id,
    orderNumber: o.number,
    description: `Order ${o.number}`,
    quantity: 1,
    unitPrice: o.total,
    lineTotal: o.total,
  }));
}

export function invoiceTotals(lines: { lineTotal: number }[]): { subtotal: number; total: number } {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  return { subtotal, total: subtotal };
}
