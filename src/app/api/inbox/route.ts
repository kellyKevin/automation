import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/inbox — chats waiting for a human (staff only).
export async function GET() {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.conversationSession.findMany({
    where: { handover: true },
    orderBy: { lastActivity: "desc" },
    include: { customer: { select: { name: true } } },
    take: 100,
  });

  const threads = sessions.map((s) => ({
    phone: s.phone,
    name: s.customer?.name ?? null,
    assignedTo: s.assignedTo,
    lastActivity: s.lastActivity,
  }));

  return NextResponse.json({ threads });
}
