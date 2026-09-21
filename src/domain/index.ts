// Shared domain vocabulary. SQLite has no native enums, so these string
// unions + const arrays are the single source of truth, validated in code.

export const ORDER_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PAID",
  "PACKED",
  "OUT_FOR_DELIVERY",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
  "ON_HOLD",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Allowed forward transitions. CANCELLED / ON_HOLD are reachable from most
// active states and handled separately (see canTransition).
const FORWARD: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED", "ON_HOLD"],
  CONFIRMED: ["PAID", "PACKED", "CANCELLED", "ON_HOLD"],
  PAID: ["PACKED", "CANCELLED", "ON_HOLD"],
  PACKED: ["OUT_FOR_DELIVERY", "DISPATCHED", "CANCELLED", "ON_HOLD"],
  OUT_FOR_DELIVERY: ["DELIVERED", "ON_HOLD"],
  DISPATCHED: ["DELIVERED", "ON_HOLD"],
  DELIVERED: [],
  CANCELLED: [],
  ON_HOLD: [
    "NEW",
    "CONFIRMED",
    "PAID",
    "PACKED",
    "OUT_FOR_DELIVERY",
    "DISPATCHED",
    "CANCELLED",
  ],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return FORWARD[from]?.includes(to) ?? false;
}

export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["MPESA", "CASH_ON_DELIVERY", "BANK"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DELIVERY_METHODS = [
  "LOCAL_RIDER",
  "COURIER",
  "BUS",
  "PICKUP",
] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const ORIGINS = ["JUJA_HUB", "ELDORET_NURSERY"] as const;
export type Origin = (typeof ORIGINS)[number];

export const PRODUCT_CATEGORIES = ["produce", "seedling", "grocery"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CUSTOMER_TYPES = ["household", "farmer", "institution"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

// The bot's conversation state machine steps.
export const CONVERSATION_STEPS = [
  "IDLE",
  "CONFIRM_ITEMS",
  "ASK_NAME",
  "PRODUCE_ZONE",
  "PRODUCE_LOCATION",
  "PRODUCE_DAY",
  "PRODUCE_RECEIVER",
  "SEEDLING_COUNTY",
  "SEEDLING_TOWN",
  "SEEDLING_METHOD",
  "SEEDLING_RECEIVER",
  "SEEDLING_DATE",
  "SUMMARY",
  "AWAIT_PAYMENT",
  "BULK_ORG",
  "BULK_ITEMS",
  "BULK_QUANTITY",
  "BULK_LOCATION",
  "HANDOVER", // handed to a human
  "DONE",
] as const;
export type ConversationStep = (typeof CONVERSATION_STEPS)[number];

// Which origin a category ships from.
export function originForCategory(category: string): Origin {
  return category === "seedling" ? "ELDORET_NURSERY" : "JUJA_HUB";
}

// Human-readable labels for customer status update messages.
export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  PAID: "Paid",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  ON_HOLD: "On hold",
};
