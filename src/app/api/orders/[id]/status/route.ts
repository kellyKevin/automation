import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { changeOrderStatus } from "@/lib/orders/service";
import { statusUpdateMessage } from "@/lib/orders/messages";
import { sendMessage, sendTemplate } from "@/lib/whatsapp/client";
import { templateForStatus } from "@/lib/whatsapp/templates";
import { isWindowOpen } from "@/lib/whatsapp/window";
import { chooseOutbound } from "@/lib/messaging/deliver";
import { ORDER_STATUSES, type OrderStatus } from "@/domain";

type SendResult = { sent: boolean; id?: string };
const failed = (): SendResult => ({ sent: false });

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
    const customer = order.customer;
    const ctx = {
      orderNumber: order.number,
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
    const decision = chooseOutbound({
      windowOpen: isWindowOpen(customer.lastInboundAt),
      hasTemplate: !!template,
    });

    if (decision === "free_form" && freeForm) {
      const res = await sendMessage(customer.phone, freeForm).catch(failed);
      await prisma.messageLog.create({
        data: {
          phone: customer.phone,
          direction: "OUT",
          content: freeForm.kind === "text" ? freeForm.body : `${freeForm.body} [${freeForm.kind}]`,
          messageType: freeForm.kind,
          waMessageId: res.id,
          status: res.sent ? "sent" : null,
        },
      });
    } else if (decision === "template" && template) {
      const res = await sendTemplate(customer.phone, template.name, template.params).catch(failed);
      await prisma.messageLog.create({
        data: {
          phone: customer.phone,
          direction: "OUT",
          content: `template:${template.name}(${template.params.join(", ")})`,
          messageType: "template",
          waMessageId: res.id,
          status: res.sent ? "sent" : null,
        },
      });
    } else if (freeForm) {
      // Window closed and no matching template — queue and alert the team.
      await prisma.outboundQueue.create({
        data: {
          phone: customer.phone,
          customerId: customer.id,
          reason: "window_closed_no_template",
          payload: JSON.stringify(freeForm),
        },
      });
      const team = process.env.TEAM_ALERT_WHATSAPP_NUMBER;
      if (team) {
        await sendMessage(team, {
          kind: "text",
          body: `⚠️ ${order.number} → ${to}: customer's 24h window is closed and no template applies. Queued for ${customer.phone}; please follow up.`,
        }).catch(failed);
      }
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
