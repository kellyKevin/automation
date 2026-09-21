import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { isWindowOpen } from "@/lib/whatsapp/window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/inbox/:phone — the message thread for one customer (staff only).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ phone: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { phone } = await params;

  const [customer, session, messages] = await Promise.all([
    prisma.customer.findUnique({ where: { phone } }),
    prisma.conversationSession.findUnique({ where: { phone } }),
    prisma.messageLog.findMany({
      where: { phone },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
  ]);

  return NextResponse.json({
    phone,
    name: customer?.name ?? null,
    handover: session?.handover ?? false,
    assignedTo: session?.assignedTo ?? null,
    windowOpen: isWindowOpen(customer?.lastInboundAt),
    messages: messages.map((m) => ({
      direction: m.direction,
      content: m.content,
      type: m.messageType,
      status: m.status,
      at: m.createdAt,
    })),
  });
}
