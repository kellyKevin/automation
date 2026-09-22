import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { generateDueStandingOrders } from "@/lib/contracts/service";
import { standingOrderConfirmTemplate } from "@/lib/whatsapp/templates";
import { notifyCustomer } from "@/lib/messaging/notify";
import { text } from "@/lib/whatsapp/messages";
import { ksh } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/jobs/standing-orders — generate orders for standing orders that are
// due, and confirm each to the customer (window-aware, standing_order_confirm
// template outside the window). Authorised by a cron secret or a staff member.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  const authorised = (!!secret && provided === secret) || (await getStaff()) !== null;
  if (!authorised) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const generated = await generateDueStandingOrders();

  for (const g of generated) {
    const name = g.customerName ?? "there";
    const schedule = g.label ?? g.frequency.toLowerCase();
    const customer = await prisma.customer.findUnique({ where: { id: g.customerId } }).catch(() => null);
    await notifyCustomer({
      phone: g.phone,
      customerId: g.customerId,
      lastInboundAt: customer?.lastInboundAt ?? null,
      freeForm: text(
        `Hi ${name}, your standing order (${schedule}) is confirmed — ` +
          `order ${g.number} for ${ksh(g.total)} is being prepared.`,
      ),
      template: standingOrderConfirmTemplate(name, schedule),
    }).catch(() => {});
  }

  return NextResponse.json({ generated: generated.length, orders: generated.map((g) => g.number) });
}
