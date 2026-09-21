import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { changeOrderStatus } from "@/lib/orders/service";
import { statusUpdateMessage } from "@/lib/orders/messages";
import { templateForStatus } from "@/lib/whatsapp/templates";
import { notifyCustomer } from "@/lib/messaging/notify";
import { ksh } from "@/lib/money";
import { getStaff } from "@/lib/auth/staff";
import { ORDER_STATUSES, type OrderStatus } from "@/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/orders/:id/status  { status, changedBy?, rider?, tracking?, ... }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await getStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const to = body?.status as OrderStatus;

  if (!to || !ORDER_STATUSES.includes(to)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const changedBy = typeof body?.changedBy === "string" ? body.changedBy : staff.name;
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
    const customer = order.customer;
    const ctx = {
      orderNumber: order.number,
      total: ksh(order.total),
      rider: body?.rider,
      riderPhone: body?.riderPhone,
      tracking: body?.tracking,
      carrier: body?.carrier,
      eta: body?.eta,
    };
    const freeForm = statusUpdateMessage(order.number, to, ctx);
    const template = templateForStatus(to, ctx);

    // The 24-hour window (Part 6): free-form inside, template outside, else
    // queue the message and alert a person.
    await notifyCustomer({
      phone: customer.phone,
      customerId: customer.id,
      lastInboundAt: customer.lastInboundAt,
      freeForm,
      template,
      teamAlert: `⚠️ ${order.number} → ${to}: customer's 24h window is closed and no template applies. Queued for ${customer.phone}; please follow up.`,
    });

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
