import { prisma } from "@/lib/db";
import { stkPush } from "./client";
import type { StkResult } from "./callback";

/**
 * Start an STK push for an order and record a pending MPESA payment tied to the
 * Daraja CheckoutRequestID, so the async callback can match it. No-ops (without
 * error) when M-Pesa isn't configured.
 */
export async function initiateStkPush(
  orderId: string,
): Promise<{ ok: boolean; checkoutRequestId?: string; error?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true },
  });
  if (!order || !order.customer) return { ok: false, error: "Order or customer not found" };

  try {
    const res = await stkPush({
      amount: order.total,
      phone: order.customer.phone,
      accountRef: order.number,
      description: `Farm City ${order.number}`,
    });
    if (!res.initiated) return { ok: false, error: "M-Pesa not configured" };

    await prisma.payment.create({
      data: {
        orderId: order.id,
        method: "MPESA",
        amount: order.total,
        status: "PENDING",
        checkoutRequestId: res.checkoutRequestId,
      },
    });
    return { ok: true, checkoutRequestId: res.checkoutRequestId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Apply a Daraja STK callback: mark the matching payment verified/failed and,
 * on success, flag the order paid.
 */
export async function handleStkCallback(result: StkResult): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: { checkoutRequestId: result.checkoutRequestId },
  });
  if (!payment) return;

  if (result.success) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "VERIFIED",
        mpesaCode: result.mpesaReceipt,
        verifiedBy: "mpesa",
        verifiedAt: new Date(),
      },
    });
    await prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "PAID" },
    });
  } else {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
  }
}
