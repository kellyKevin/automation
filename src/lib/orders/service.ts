import { prisma } from "@/lib/db";
import type { Prisma, PrismaClient } from "@prisma/client";
import { computeTotals } from "@/lib/bot/pricing";
import type { OrderDraft } from "@/lib/bot/types";
import { canTransition, type OrderStatus } from "@/domain";
import { formatOrderNumber } from "./number";

type Tx = Prisma.TransactionClient | PrismaClient;

const ORDER_COUNTER = "order";

/** Atomically reserve the next order number within a transaction. */
export async function nextOrderNumber(tx: Tx): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { name: ORDER_COUNTER },
    create: { name: ORDER_COUNTER, value: 1 },
    update: { value: { increment: 1 } },
  });
  return formatOrderNumber(counter.value);
}

export interface CreateOrderResult {
  orderId: string;
  number: string;
  total: number;
}

/**
 * Persist a confirmed draft as an Order (+ items, delivery, status history) and
 * reserve stock. Runs in a single transaction so the order number and the rows
 * are always consistent.
 */
export async function createOrderFromDraft(
  customerId: string,
  draft: OrderDraft,
): Promise<CreateOrderResult> {
  const totals = computeTotals(draft.items, draft.delivery.fee ?? 0);

  return prisma.$transaction(async (tx) => {
    const number = await nextOrderNumber(tx);

    const order = await tx.order.create({
      data: {
        number,
        customerId,
        source: "website_cart",
        cartRef: draft.ref,
        origin: draft.origin ?? "JUJA_HUB",
        status: "NEW",
        paymentStatus: "PENDING",
        subtotal: totals.subtotal,
        discount: totals.discount,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        notes: draft.bulk ? "Bulk order — review pricing" : undefined,
        items: {
          create: draft.items.map((it) => ({
            productName: it.name,
            variety: undefined,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
            lineTotal: Math.round((it.quantity * it.unitPrice + Number.EPSILON) * 100) / 100,
            product: it.slug ? { connect: { slug: it.slug } } : undefined,
          })),
        },
        delivery: {
          create: {
            method: draft.delivery.method ?? "LOCAL_RIDER",
            zoneId: draft.delivery.zoneId,
            address: draft.delivery.address,
            landmark: draft.delivery.landmark,
            county: draft.delivery.county,
            town: draft.delivery.town,
            receiverName: draft.delivery.receiverName,
            receiverPhone: draft.delivery.receiverPhone,
            timeWindow: draft.delivery.timeWindow,
          },
        },
        statusHistory: {
          create: { oldStatus: null, newStatus: "NEW", changedBy: "bot" },
        },
      },
    });

    // Reserve stock for resolved catalogue items.
    for (const it of draft.items) {
      if (it.slug) {
        await tx.product.update({
          where: { slug: it.slug },
          data: { stock: { decrement: it.quantity } },
        }).catch(() => {
          /* unknown slug — ignore, item priced 0 anyway */
        });
      }
    }

    // Stamp firstOrderAt on the customer if this is their first order.
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (customer && !customer.firstOrderAt) {
      await tx.customer.update({
        where: { id: customerId },
        data: { firstOrderAt: new Date() },
      });
    }

    return { orderId: order.id, number, total: totals.total };
  });
}

/** Change an order's status, enforcing the lifecycle and writing history. */
export async function changeOrderStatus(
  orderId: string,
  to: OrderStatus,
  changedBy: string,
): Promise<{ ok: boolean; error?: string; from?: OrderStatus }> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return { ok: false, error: "Order not found" };
    const from = order.status as OrderStatus;
    if (!canTransition(from, to)) {
      return { ok: false, error: `Cannot move from ${from} to ${to}`, from };
    }
    await tx.order.update({ where: { id: orderId }, data: { status: to } });
    await tx.statusHistory.create({
      data: { orderId, oldStatus: from, newStatus: to, changedBy },
    });
    return { ok: true, from };
  });
}

/** Record an M-Pesa code against an order's most recent (or new) payment. */
export async function recordMpesaCode(
  orderId: string,
  code: string,
): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  await prisma.payment.create({
    data: {
      orderId,
      method: "MPESA",
      amount: order.total,
      mpesaCode: code,
      status: "PENDING",
    },
  });
}

/** Mark an order as cash-on-delivery. */
export async function markCashOnDelivery(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  await prisma.payment.create({
    data: {
      orderId,
      method: "CASH_ON_DELIVERY",
      amount: order.total,
      status: "PENDING",
    },
  });
}
