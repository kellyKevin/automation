import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { customerStats } from "@/lib/customers/summary";
import { isWindowOpen } from "@/lib/whatsapp/window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/customers/:phone — staff: one customer with their orders and quotes.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { phone } = await params;

  const c = await prisma.customer.findUnique({
    where: { phone },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          number: true,
          status: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      },
      bulkQuotes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, itemsSummary: true, quotedAmount: true, createdAt: true },
      },
    },
  });

  if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  return NextResponse.json({
    customer: {
      phone: c.phone,
      name: c.name,
      type: c.type,
      defaultAddress: c.defaultAddress,
      optedOut: c.optedOut,
      firstOrderAt: c.firstOrderAt,
      lastInboundAt: c.lastInboundAt,
      windowOpen: isWindowOpen(c.lastInboundAt),
      stats: customerStats(c.orders.map((o) => ({ ...o, createdAt: o.createdAt }))),
      orders: c.orders.map((o) => ({
        number: o.number,
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: o.total,
        createdAt: o.createdAt,
        itemCount: o._count.items,
      })),
      quotes: c.bulkQuotes,
    },
  });
}
