import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { parseStandingOrder } from "@/lib/contracts/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
