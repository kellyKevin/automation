import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { parseBulkQuote } from "@/lib/quotes/quote";
import { sendMessage } from "@/lib/whatsapp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/quotes — public: the storefront bulk/institutional form submits here.
export async function POST(req: NextRequest) {
  const parsed = parseBulkQuote(await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const quote = await prisma.bulkQuote.create({ data: parsed.data });

  // Alert the team (best effort; no-op without WhatsApp credentials).
  const team = process.env.TEAM_ALERT_WHATSAPP_NUMBER;
  if (team) {
    await sendMessage(team, {
      kind: "text",
      body:
        `🧾 New bulk quote request\n` +
        `${quote.organisation ?? quote.contactPerson ?? "—"} (${quote.phone})\n` +
        `Items: ${quote.itemsSummary}\nQty: ${quote.quantity ?? "-"}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: quote.id }, { status: 201 });
}

// GET /api/quotes — staff: list quote requests.
export async function GET() {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const quotes = await prisma.bulkQuote.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ quotes });
}
