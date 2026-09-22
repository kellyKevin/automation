// Validation for creating a standing order (Phase 2). Pure + tested; the API
// route turns the returned value into a Prisma create.

import { isFrequency, type Frequency } from "./schedule";

export interface StandingOrderItemInput {
  slug: string | null;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface StandingOrderInput {
  contractId: string;
  label: string | null;
  frequency: Frequency;
  origin: string;
  method: string;
  zoneId: string | null;
  address: string | null;
  county: string | null;
  town: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  deliveryFee: number;
  nextRunAt: Date;
  items: StandingOrderItemInput[];
}

export type StandingOrderParse =
  | { ok: true; data: StandingOrderInput }
  | { ok: false; error: string };

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : NaN);

export function parseStandingOrder(input: unknown): StandingOrderParse {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid request body" };
  const b = input as Record<string, unknown>;

  const contractId = str(b.contractId);
  if (!contractId) return { ok: false, error: "A contract is required" };

  if (!isFrequency(b.frequency)) return { ok: false, error: "Invalid frequency" };

  const rawItems = Array.isArray(b.items) ? b.items : [];
  const items: StandingOrderItemInput[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const productName = str(r.productName);
    const quantity = num(r.quantity);
    const unit = str(r.unit);
    const unitPrice = num(r.unitPrice);
    if (!productName || !unit || !(quantity > 0) || !(unitPrice >= 0)) {
      return { ok: false, error: "Each item needs a name, unit, quantity and price" };
    }
    items.push({ slug: str(r.slug), productName, quantity, unit, unitPrice });
  }
  if (items.length === 0) return { ok: false, error: "Add at least one item" };

  const startRaw = str(b.nextRunAt) ?? str(b.startAt);
  const nextRunAt = startRaw ? new Date(startRaw) : new Date();
  if (Number.isNaN(nextRunAt.getTime())) return { ok: false, error: "Invalid start date" };

  const fee = num(b.deliveryFee);

  return {
    ok: true,
    data: {
      contractId,
      label: str(b.label),
      frequency: b.frequency,
      origin: str(b.origin) ?? "JUJA_HUB",
      method: str(b.method) ?? "LOCAL_RIDER",
      zoneId: str(b.zoneId),
      address: str(b.address),
      county: str(b.county),
      town: str(b.town),
      receiverName: str(b.receiverName),
      receiverPhone: str(b.receiverPhone),
      deliveryFee: fee >= 0 ? fee : 0,
      nextRunAt,
      items,
    },
  };
}
