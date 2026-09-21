// Message templates (Part 5). Templates are the only messages that may be sent
// outside the 24-hour window, and each must be pre-approved in the Meta
// dashboard with a matching name, language and variable order.
//
// This registry is the single place that maps an order status to the template
// used when the window is closed, and defines each template's body variables.

import type { OrderStatus } from "@/domain";

export const TEMPLATE_NAMES = [
  "order_received",
  "payment_reminder",
  "payment_received",
  "order_packed",
  "out_for_delivery",
  "seedlings_dispatched",
  "order_delivered",
  "quote_ready",
  "standing_order_confirm",
] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export const DEFAULT_TEMPLATE_LANGUAGE = "en";

export interface StatusTemplateContext {
  orderNumber: string;
  rider?: string;
  riderPhone?: string;
  carrier?: string;
  tracking?: string;
  eta?: string;
}

export interface ResolvedTemplate {
  name: TemplateName;
  /** Ordered body variables ({{1}}, {{2}}, …). */
  params: string[];
}

/**
 * The template to send for a status change when the 24-hour window is closed,
 * or null when no out-of-window template applies to that status (e.g. NEW /
 * CONFIRMED happen while the customer is actively chatting).
 */
export function templateForStatus(
  status: OrderStatus,
  ctx: StatusTemplateContext,
): ResolvedTemplate | null {
  switch (status) {
    case "PAID":
      return { name: "payment_received", params: [ctx.orderNumber] };
    case "PACKED":
      return { name: "order_packed", params: [ctx.orderNumber] };
    case "OUT_FOR_DELIVERY":
      return {
        name: "out_for_delivery",
        params: [ctx.orderNumber, ctx.rider ?? "our rider", ctx.riderPhone ?? "-"],
      };
    case "DISPATCHED":
      return {
        name: "seedlings_dispatched",
        params: [
          ctx.orderNumber,
          ctx.carrier ?? "courier",
          ctx.tracking ?? "-",
          ctx.eta ?? "soon",
        ],
      };
    case "DELIVERED":
      return { name: "order_delivered", params: [ctx.orderNumber] };
    default:
      return null;
  }
}
