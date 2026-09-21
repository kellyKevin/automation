import { NextRequest, NextResponse } from "next/server";
import { getStaff } from "@/lib/auth/staff";
import { ordersDueForPaymentReminder, markOrderReminded } from "@/lib/orders/service";
import { paymentReminderMessage } from "@/lib/orders/messages";
import { paymentReminderTemplate } from "@/lib/whatsapp/templates";
import { notifyCustomer } from "@/lib/messaging/notify";
import { ksh } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/jobs/payment-reminders — remind customers whose orders are still
// unpaid (Part 5). Window-aware: free-form inside the 24h window, otherwise the
// approved payment_reminder template. Each order is reminded once. Authorised
// by a cron secret (x-cron-secret === CRON_SECRET) or a signed-in staff member.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  const authorised = (!!secret && provided === secret) || (await getStaff()) !== null;
  if (!authorised) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const minutes = Number(process.env.PAYMENT_REMINDER_MINUTES || 60);
  const paybill = process.env.MPESA_PAYBILL || "000000";
  const due = await ordersDueForPaymentReminder(minutes);

  let reminded = 0;
  for (const order of due) {
    if (!order.customer || order.customer.optedOut) {
      await markOrderReminded(order.id);
      continue;
    }
    await notifyCustomer({
      phone: order.customer.phone,
      customerId: order.customerId,
      lastInboundAt: order.customer.lastInboundAt,
      freeForm: paymentReminderMessage(order.number, order.total, paybill),
      template: paymentReminderTemplate(order.number, ksh(order.total), paybill),
    });
    await markOrderReminded(order.id);
    reminded += 1;
  }

  return NextResponse.json({ reminded, considered: due.length, olderThanMinutes: minutes });
}
