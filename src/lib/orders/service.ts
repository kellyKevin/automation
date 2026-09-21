import { prisma } from "@/lib/db";
import type { Prisma, PrismaClient } from "@prisma/client";
import { computeTotals, type Totals } from "@/lib/bot/pricing";
import type { OrderDraft, DraftItem, DraftDelivery, CompletedSegment } from "@/lib/bot/types";
import { canTransition, type OrderStatus } from "@/domain";
import { formatOrderNumber } from "./number";
import { holdsReservation } from "./stock";

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
  origin: string;
}

// The order-level fields one order is built from (a whole draft or a segment).
interface OrderSource {
  ref?: string;
  origin?: string;
  bulk?: boolean;
  items: DraftItem[];
  delivery: DraftDelivery;
}

function buildOrderData(
  number: string,
  customerId: string,
  src: OrderSource,
  totals: Totals,
) {
  return {
    number,
    customerId,
    source: "website_cart",
    cartRef: src.ref,
    origin: src.origin ?? "JUJA_HUB",
    status: "NEW",
    paymentStatus: "PENDING",
    subtotal: totals.subtotal,
    discount: totals.discount,
    deliveryFee: totals.deliveryFee,
    total: totals.total,
    notes: src.bulk ? "Bulk order — review pricing" : undefined,
    items: {
      create: src.items.map((it) => ({
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
        method: src.delivery.method ?? "LOCAL_RIDER",
        zoneId: src.delivery.zoneId,
        address: src.delivery.address,
        landmark: src.delivery.landmark,
        county: src.delivery.county,
        town: src.delivery.town,
        receiverName: src.delivery.receiverName,
        receiverPhone: src.delivery.receiverPhone,
        timeWindow: src.delivery.timeWindow,
      },
    },
    statusHistory: {
      create: { oldStatus: null, newStatus: "NEW", changedBy: "bot" },
    },
  };
}

/** Reserve stock when an order is created (holds it without deducting). */
async function reserveStock(tx: Tx, items: DraftItem[]): Promise<void> {
  for (const it of items) {
    if (it.slug) {
      await tx.product
        .update({ where: { slug: it.slug }, data: { reserved: { increment: it.quantity } } })
        .catch(() => {
          /* unknown slug — ignore, item priced 0 anyway */
        });
    }
  }
}

/**
 * Adjust the reservation for an order's items:
 *  - "fulfil"  (on packing): deduct physical stock and clear the reservation.
 *  - "release" (on cancel / unpaid lapse): return the reservation only.
 */
async function adjustReservation(
  tx: Tx,
  orderId: string,
  mode: "fulfil" | "release",
): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const it of items) {
    if (!it.productId) continue;
    const data =
      mode === "fulfil"
        ? { stock: { decrement: it.quantity }, reserved: { decrement: it.quantity } }
        : { reserved: { decrement: it.quantity } };
    await tx.product.update({ where: { id: it.productId }, data }).catch(() => {});
  }
}

async function stampFirstOrder(tx: Tx, customerId: string): Promise<void> {
  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (customer && !customer.firstOrderAt) {
    await tx.customer.update({ where: { id: customerId }, data: { firstOrderAt: new Date() } });
  }
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
  const src: OrderSource = {
    ref: draft.ref,
    origin: draft.origin,
    bulk: draft.bulk,
    items: draft.items,
    delivery: draft.delivery,
  };

  return prisma.$transaction(async (tx) => {
    const number = await nextOrderNumber(tx);
    const order = await tx.order.create({ data: buildOrderData(number, customerId, src, totals) });
    await reserveStock(tx, draft.items);
    await stampFirstOrder(tx, customerId);
    return { orderId: order.id, number, total: totals.total, origin: src.origin ?? "JUJA_HUB" };
  });
}

/**
 * A mixed cart becomes two linked orders (Part 2.4): produce from Juja and
 * seedlings from Eldoret, each with its own delivery and fee, created together
 * and cross-linked so either order points at the other.
 */
export async function createLinkedOrders(
  customerId: string,
  segments: CompletedSegment[],
  meta: { ref?: string } = {},
): Promise<CreateOrderResult[]> {
  return prisma.$transaction(async (tx) => {
    const created: CreateOrderResult[] = [];
    for (const seg of segments) {
      const totals = computeTotals(seg.items, seg.delivery.fee ?? 0);
      const number = await nextOrderNumber(tx);
      const order = await tx.order.create({
        data: buildOrderData(number, customerId, {
          ref: meta.ref,
          origin: seg.origin,
          items: seg.items,
          delivery: seg.delivery,
        }, totals),
      });
      created.push({ orderId: order.id, number, total: totals.total, origin: seg.origin });
      await reserveStock(tx, seg.items);
    }

    // Cross-link the pair.
    if (created.length === 2) {
      await tx.order.update({ where: { id: created[0].orderId }, data: { linkedOrderId: created[1].orderId } });
      await tx.order.update({ where: { id: created[1].orderId }, data: { linkedOrderId: created[0].orderId } });
    }

    await stampFirstOrder(tx, customerId);
    return created;
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

    // Stock lifecycle: packing fulfils the reservation (deducts stock);
    // cancelling before packing releases it back.
    if (to === "PACKED") {
      await adjustReservation(tx, orderId, "fulfil");
    } else if (to === "CANCELLED" && holdsReservation(from)) {
      await adjustReservation(tx, orderId, "release");
    }

    return { ok: true, from };
  });
}

/**
 * Release stock held by unpaid orders older than the limit and put them on hold
 * (Part 10). Intended to be run periodically (see /api/jobs/release-unpaid).
 * Returns the number of orders lapsed.
 */
export async function releaseUnpaidOrders(olderThanMinutes: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "PENDING",
      status: { in: ["NEW", "CONFIRMED"] },
      createdAt: { lt: cutoff },
    },
    select: { id: true, status: true },
  });

  for (const o of orders) {
    await prisma.$transaction(async (tx) => {
      await adjustReservation(tx, o.id, "release");
      await tx.order.update({ where: { id: o.id }, data: { status: "ON_HOLD" } });
      await tx.statusHistory.create({
        data: {
          orderId: o.id,
          oldStatus: o.status,
          newStatus: "ON_HOLD",
          changedBy: "system:unpaid-timeout",
        },
      });
    });
  }
  return orders.length;
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
