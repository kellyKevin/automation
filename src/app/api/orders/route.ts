import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/orders?status=NEW — list orders for the admin panel.
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const orders = await prisma.order.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true, phone: true } },
      items: true,
      delivery: true,
      payments: true,
    },
  });
  return NextResponse.json({ orders });
}
