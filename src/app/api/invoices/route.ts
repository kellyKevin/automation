import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { generateInvoiceForContract } from "@/lib/contracts/invoices";
import { eatStartOfDay, eatEndOfDay } from "@/lib/contracts/eat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/invoices — staff: recent invoices with their contract customer.
export async function GET() {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      contract: { include: { customer: { select: { name: true, phone: true } } } },
      _count: { select: { lines: true } },
    },
  });
  return NextResponse.json({ invoices });
}

// POST /api/invoices { contractId, periodStart, periodEnd } — staff: generate a
// DRAFT invoice for a contract's un-invoiced orders in the period.
export async function POST(req: NextRequest) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  const contractId = typeof b?.contractId === "string" ? b.contractId : "";
  // Interpret the picked dates in EAT so the period covers whole local days.
  const start = typeof b?.periodStart === "string" ? eatStartOfDay(b.periodStart) : new Date(NaN);
  const end = typeof b?.periodEnd === "string" ? eatEndOfDay(b.periodEnd) : new Date(NaN);
  if (!contractId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "contractId, periodStart and periodEnd are required" }, { status: 400 });
  }
  if (end.getTime() < start.getTime()) {
    return NextResponse.json({ error: "The period end is before its start" }, { status: 400 });
  }

  const result = await generateInvoiceForContract(contractId, start, end);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
