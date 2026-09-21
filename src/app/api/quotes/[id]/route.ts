import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { notifyCustomer } from "@/lib/messaging/notify";
import { quoteReadyTemplate } from "@/lib/whatsapp/templates";
import { text } from "@/lib/whatsapp/messages";
import { ksh } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "QUOTED", "WON", "LOST"];

// PATCH /api/quotes/:id { status?, assignedTo?, quotedAmount? } (staff only).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: { status?: string; assignedTo?: string | null; quotedAmount?: number | null } = {};
  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body?.assignedTo !== undefined) {
    data.assignedTo = typeof body.assignedTo === "string" && body.assignedTo.trim() ? body.assignedTo.trim() : null;
  }
  if (body?.quotedAmount !== undefined) {
    const n = Number(body.quotedAmount);
    data.quotedAmount = Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const quote = await prisma.bulkQuote.update({ where: { id }, data }).catch(() => null);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  // quote_ready trigger (Part 5): tell the customer their quote is ready when
  // staff move it to QUOTED with an amount and we have a phone to reach them.
  if (data.status === "QUOTED" && quote.phone && quote.quotedAmount != null) {
    const name = quote.contactPerson ?? quote.organisation ?? "there";
    const amount = ksh(quote.quotedAmount);
    const customer = await prisma.customer.findUnique({ where: { phone: quote.phone } }).catch(() => null);
    await notifyCustomer({
      phone: quote.phone,
      customerId: customer?.id ?? null,
      lastInboundAt: customer?.lastInboundAt ?? null,
      freeForm: text(
        `Hi ${name}, your Farm City bulk quote is ready: ${amount}. ` +
          `Reply here and we'll help you place the order.`,
      ),
      template: quoteReadyTemplate(name, amount),
    }).catch(() => {});
  }

  return NextResponse.json({ quote });
}
