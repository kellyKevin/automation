import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "SENT", "PAID", "VOID"];

// GET /api/invoices/:id — staff: one invoice with its lines and customer.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { orderNumber: "asc" } },
      contract: { include: { customer: { select: { name: true, phone: true } } } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  return NextResponse.json({ invoice });
}

// PATCH /api/invoices/:id { status } — staff: DRAFT → SENT → PAID (or VOID).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (typeof b?.status !== "string" || !STATUSES.includes(b.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const data: { status: string; sentAt?: Date; paidAt?: Date } = { status: b.status };
  if (b.status === "SENT") data.sentAt = new Date();
  if (b.status === "PAID") data.paidAt = new Date();

  const invoice = await prisma.invoice.update({ where: { id }, data }).catch(() => null);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  return NextResponse.json({ invoice });
}
