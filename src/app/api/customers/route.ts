import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { customerStats } from "@/lib/customers/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/customers?q= — staff: customers with order counts, spend and last
// order. Optional case-insensitive search on name or phone.
export async function GET(req: NextRequest) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: 300,
    include: {
      orders: { select: { total: true, paymentStatus: true, status: true, createdAt: true } },
    },
  });

  return NextResponse.json({
    customers: customers.map((c) => ({
      phone: c.phone,
      name: c.name,
      type: c.type,
      optedOut: c.optedOut,
      lastInboundAt: c.lastInboundAt,
      ...customerStats(c.orders),
    })),
  });
}
