import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { parseDeliveryUpdate } from "@/lib/orders/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/orders/:id/delivery — staff: assign a rider/courier, set the
// tracking number, delivery method, time window or requested date.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = parseDeliveryUpdate(await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Upsert so an order without a delivery row (e.g. pickup) can still be edited.
  const delivery = await prisma.delivery.upsert({
    where: { orderId: id },
    update: parsed.data,
    create: { orderId: id, method: parsed.data.method ?? "LOCAL_RIDER", ...parsed.data },
  });

  return NextResponse.json({ ok: true, delivery });
}
