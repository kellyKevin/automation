import { prisma } from "@/lib/db";
import { createOrderFromDraft } from "@/lib/orders/service";
import { rollForward, type Frequency } from "./schedule";
import type { OrderDraft } from "@/lib/bot/types";
import type { Origin } from "@/domain";

export interface GeneratedStandingOrder {
  standingOrderId: string;
  label: string | null;
  frequency: string;
  orderId: string;
  number: string;
  total: number;
  customerId: string;
  phone: string;
  customerName: string | null;
}

/**
 * Generate real orders from every standing order that is due at `now`, then
 * roll each one's next run into the future. Reuses the normal order pipeline
 * (numbering, stock reservation, totals), so standing orders behave exactly
 * like any other order downstream.
 */
export async function generateDueStandingOrders(
  now: Date = new Date(),
): Promise<GeneratedStandingOrder[]> {
  const due = await prisma.standingOrder.findMany({
    where: { active: true, nextRunAt: { lte: now }, contract: { active: true } },
    include: { items: true, contract: { include: { customer: true } } },
  });

  const created: GeneratedStandingOrder[] = [];
  for (const so of due) {
    const customer = so.contract.customer;
    const draft: OrderDraft = {
      origin: so.origin as Origin,
      customerName: customer.name ?? undefined,
      items: so.items.map((it) => ({
        slug: it.slug ?? undefined,
        name: it.productName,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        available: true,
        resolved: true,
      })),
      delivery: {
        method: so.method,
        zoneId: so.zoneId ?? undefined,
        address: so.address ?? undefined,
        county: so.county ?? undefined,
        town: so.town ?? undefined,
        receiverName: so.receiverName ?? undefined,
        receiverPhone: so.receiverPhone ?? undefined,
        fee: so.deliveryFee,
      },
    };

    const res = await createOrderFromDraft(customer.id, draft);
    await prisma.standingOrder.update({
      where: { id: so.id },
      data: { lastRunAt: now, nextRunAt: rollForward(so.frequency as Frequency, so.nextRunAt, now) },
    });

    created.push({
      standingOrderId: so.id,
      label: so.label,
      frequency: so.frequency,
      orderId: res.orderId,
      number: res.number,
      total: res.total,
      customerId: customer.id,
      phone: customer.phone,
      customerName: customer.name,
    });
  }
  return created;
}
