import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { changeOrderStatus } from "@/lib/orders/service";
import { statusUpdateMessage } from "@/lib/orders/messages";
import { sendMessage } from "@/lib/whatsapp/client";
import { ORDER_STATUSES, type OrderStatus } from "@/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/orders/:id/status  { status, changedBy?, rider?, tracking?, ... }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const to = body?.status as OrderStatus;

  if (!to || !ORDER_STATUSES.includes(to)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const changedBy = typeof body?.changedBy === "string" ? body.changedBy : "staff";
  const result = await changeOrderStatus(id, to, changedBy);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  // Notify the customer (best effort).
  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (order?.customer && !order.customer.optedOut) {
    const msg = statusUpdateMessage(order.number, to, {
      rider: body?.rider,
      riderPhone: body?.riderPhone,
      tracking: body?.tracking,
      carrier: body?.carrier,
      eta: body?.eta,
    });
    if (msg) {
      await sendMessage(order.customer.phone, msg).catch(() => {});
      await prisma.messageLog.create({
        data: {
          phone: order.customer.phone,
          direction: "OUT",
          content: msg.kind === "text" ? msg.body : msg.body + ` [${msg.kind}]`,
          messageType: msg.kind,
        },
      });
    }

    // Keep paymentStatus in step with a PAID transition.
    if (to === "PAID") {
      await prisma.order.update({
        where: { id },
        data: { paymentStatus: "PAID" },
      });
    }
  }

  return NextResponse.json({ ok: true, from: result.from, to });
}
