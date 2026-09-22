import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { salesTotals, topProducts } from "@/lib/reports/aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/reports?days=30 — staff: sales summary, best sellers and the
// outstanding (unpaid) orders over the period.
export async function GET(req: NextRequest) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    select: { total: true, paymentStatus: true, status: true },
  });

  const items = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: since }, status: { not: "CANCELLED" } } },
    select: { productName: true, quantity: true, lineTotal: true },
  });

  const unpaid = await prisma.order.findMany({
    where: {
      createdAt: { gte: since },
      paymentStatus: "PENDING",
      status: { notIn: ["CANCELLED"] },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      number: true,
      total: true,
      status: true,
      createdAt: true,
      customer: { select: { name: true, phone: true } },
    },
  });

  return NextResponse.json({
    days,
    totals: salesTotals(orders),
    bestSellers: topProducts(items, 10),
    unpaid: unpaid.map((o) => ({
      number: o.number,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
      customer: o.customer?.name ?? null,
      phone: o.customer?.phone ?? null,
    })),
  });
}
