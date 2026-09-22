import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { parseStandingOrder } from "@/lib/contracts/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/standing-orders — staff: every standing order with the fields that
// decide whether it generates, plus the server clock and a `due` flag. Handy
// for diagnosing "Generated 0 orders".
export async function GET() {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const rows = await prisma.standingOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { contract: { select: { active: true, organisation: true } }, _count: { select: { items: true } } },
  });
  return NextResponse.json({
    serverTime: now.toISOString(),
    total: rows.length,
    standingOrders: rows.map((s) => ({
      id: s.id,
      label: s.label,
      active: s.active,
      contractActive: s.contract.active,
      items: s._count.items,
      nextRunAt: s.nextRunAt.toISOString(),
      due: s.active && s.contract.active && s.nextRunAt.getTime() <= now.getTime(),
    })),
  });
}

// POST /api/standing-orders — staff: create a recurring order for a contract.
export async function POST(req: NextRequest) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = parseStandingOrder(await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const d = parsed.data;

  const contract = await prisma.contractCustomer.findUnique({ where: { id: d.contractId } });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const so = await prisma.standingOrder.create({
    data: {
      contractId: d.contractId,
      label: d.label,
      frequency: d.frequency,
      origin: d.origin,
      method: d.method,
      zoneId: d.zoneId,
      address: d.address,
      county: d.county,
      town: d.town,
      receiverName: d.receiverName,
      receiverPhone: d.receiverPhone,
      deliveryFee: d.deliveryFee,
      nextRunAt: d.nextRunAt,
      items: {
        create: d.items.map((it) => ({
          slug: it.slug,
          productName: it.productName,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
        })),
      },
    },
    include: { items: true },
  });
  return NextResponse.json({ standingOrder: so }, { status: 201 });
}
