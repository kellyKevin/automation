import type { ConversationStep, Origin } from "@/domain";
import type { OutboundMessage } from "@/lib/whatsapp/messages";

// A catalogue product as the engine needs to see it (a snapshot passed in by
// the caller — the engine never touches the database).
export interface CatalogProduct {
  slug: string;
  name: string;
  category: string;
  variety?: string | null;
  unit: string;
  price: number;
  available: boolean;
  stock: number;
  origin: string;
}

export interface CatalogZone {
  id: string;
  name: string;
  type: string; // LOCAL | COUNTRYWIDE
  fee: number;
  minimumOrder: number;
  cutoffTime?: string | null;
}

export interface Catalog {
  products: CatalogProduct[];
  zones: CatalogZone[];
}

// An item on the in-progress order. `resolved` is set once matched against the
// catalogue (price known); unmatched items keep price 0 until a human helps.
export interface DraftItem {
  slug?: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  available: boolean;
  resolved: boolean;
}

export interface DraftDelivery {
  method?: string; // DeliveryMethod
  zoneId?: string;
  zoneName?: string;
  fee?: number;
  address?: string;
  landmark?: string;
  county?: string;
  town?: string;
  receiverName?: string;
  receiverPhone?: string;
  requestedDate?: string;
  timeWindow?: string;
}

export interface OrderDraft {
  ref?: string;
  path?: "produce" | "seedling" | "mixed";
  origin?: Origin;
  customerName?: string;
  items: DraftItem[];
  delivery: DraftDelivery;
  bulk?: boolean;
  /** Consecutive unrecognised replies at the current step. */
  retries?: number;
}

export function emptyDraft(): OrderDraft {
  return { items: [], delivery: {} };
}

// What the caller knows about the sender before the turn runs.
export interface KnownCustomer {
  name?: string | null;
  defaultAddress?: string | null;
  isReturning: boolean;
}

export interface EngineInput {
  step: ConversationStep;
  draft: OrderDraft;
  customer: KnownCustomer;
  catalog: Catalog;
  // Normalised inbound signal.
  text?: string;
  replyId?: string;
  now?: Date;
}

// Side effects the webhook layer must carry out after the pure turn.
export type Effect =
  | { type: "SAVE_CUSTOMER_NAME"; name: string }
  | { type: "CREATE_ORDER"; draft: OrderDraft }
  | { type: "RECORD_MPESA_CODE"; code: string }
  | { type: "MARK_CASH_ON_DELIVERY" }
  | { type: "CREATE_BULK_QUOTE"; draft: OrderDraft }
  | { type: "HANDOVER"; reason: string }
  | { type: "OPT_OUT" };

export interface EngineResult {
  step: ConversationStep;
  draft: OrderDraft;
  replies: OutboundMessage[];
  effects: Effect[];
}
