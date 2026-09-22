import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { groupDispatch, type DispatchOrder } from "@/lib/dispatch/group";
import { ORDER_STATUSES } from "@/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Statuses that represent an order being fulfilled (ready to go out).
const DEFAULT_STATUSES = ["CONFIRMED", "PAID", "PACKED", "OUT_FOR_DELIVERY", "DISPATCHED"];

// GET /api/dispatch?status=PACKED,OUT_FOR_DELIVERY — staff: orders being
// fulfilled, grouped into rider runs and courier/dispatch runs for printing.
export async function GET(req: NextRequest) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = (req.nextUrl.searchParams.get("status") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => (ORDER_STATUSES as readonly string[]).includes(s));
  const statuses = requested.length > 0 ? requested : DEFAULT_STATUSES;

  const orders = await prisma.order.findMany({
    where: { status: { in: statuses } },
    orderBy: { number: "asc" },
    include: {
      delivery: { include: { zone: true } },
      items: { select: { productName: true, quantity: true, unit: true } },
    },
  });

  const rows: DispatchOrder[] = orders.map((o) => ({
    number: o.number,
    status: o.status,
    paymentStatus: o.paymentStatus,
    total: o.total,
    origin: o.origin,
    method: o.delivery?.method ?? null,
    zoneName: o.delivery?.zone?.name ?? null,
    county: o.delivery?.county ?? null,
    town: o.delivery?.town ?? null,
    address: o.delivery?.address ?? null,
    landmark: o.delivery?.landmark ?? null,
    receiverName: o.delivery?.receiverName ?? null,
    receiverPhone: o.delivery?.receiverPhone ?? null,
    assignedTo: o.delivery?.assignedTo ?? null,
    trackingNumber: o.delivery?.trackingNumber ?? null,
    items: o.items,
  }));

  return NextResponse.json({ statuses, count: rows.length, ...groupDispatch(rows) });
}
