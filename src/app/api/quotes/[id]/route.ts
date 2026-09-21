import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";

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
  return NextResponse.json({ quote });
}
