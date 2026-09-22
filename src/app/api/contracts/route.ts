import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/contracts — staff: contract customers with their standing orders.
export async function GET() {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const contracts = await prisma.contractCustomer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, phone: true } },
      standingOrders: {
        orderBy: { createdAt: "desc" },
        include: { items: { select: { productName: true, quantity: true, unit: true, unitPrice: true } } },
      },
    },
  });
  return NextResponse.json({ contracts });
}

// POST /api/contracts — staff: put a customer on contract terms. Looks up (or
// creates) the Customer by phone, then attaches contract details.
export async function POST(req: NextRequest) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  const phone = typeof b?.phone === "string" ? b.phone.replace(/[^\d]/g, "") : "";
  if (phone.length < 9) {
    return NextResponse.json({ error: "A valid phone number is required" }, { status: 400 });
  }

  const customer = await prisma.customer.upsert({
    where: { phone },
    create: { phone, name: typeof b?.contactPerson === "string" ? b.contactPerson : undefined, type: "institution" },
    update: {},
  });

  const existing = await prisma.contractCustomer.findUnique({ where: { customerId: customer.id } });
  if (existing) {
    return NextResponse.json({ error: "This customer is already on contract" }, { status: 409 });
  }

  const contract = await prisma.contractCustomer.create({
    data: {
      customerId: customer.id,
      organisation: typeof b?.organisation === "string" ? b.organisation.trim() || null : null,
      contactPerson: typeof b?.contactPerson === "string" ? b.contactPerson.trim() || null : null,
      billingEmail: typeof b?.billingEmail === "string" ? b.billingEmail.trim() || null : null,
      paymentTerms: typeof b?.paymentTerms === "string" ? b.paymentTerms.trim() || null : null,
    },
  });
  return NextResponse.json({ contract }, { status: 201 });
}
