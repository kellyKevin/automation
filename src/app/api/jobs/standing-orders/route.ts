import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { cronSecretOk } from "@/lib/jobs/cron";
import { generateDueStandingOrders } from "@/lib/contracts/service";
import { standingOrderConfirmTemplate } from "@/lib/whatsapp/templates";
import { notifyCustomer } from "@/lib/messaging/notify";
import { text } from "@/lib/whatsapp/messages";
import { ksh } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generate orders for standing orders that are due, and confirm each to the
// customer (window-aware, standing_order_confirm template outside the window).
// Authorised by a cron secret (x-cron-secret or Vercel's Authorization: Bearer)
// or a staff member. GET is for Vercel Cron; POST is for the dashboard.
async function handle(req: NextRequest) {
  if (!cronSecretOk(req) && !(await getStaff())) {
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

export const GET = handle;
export const POST = handle;
