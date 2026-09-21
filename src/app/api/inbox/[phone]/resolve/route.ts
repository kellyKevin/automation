import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { sendMessage } from "@/lib/whatsapp/client";
import { isWindowOpen } from "@/lib/whatsapp/window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/inbox/:phone/resolve — end the handover and let the bot resume.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ phone: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { phone } = await params;

  await prisma.conversationSession
    .update({
      where: { phone },
      data: { handover: false, assignedTo: null, step: "IDLE", draft: null },
    })
    .catch(() => {});

  // Let the customer know they're back with the assistant (if still in window).
  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (isWindowOpen(customer?.lastInboundAt)) {
    await sendMessage(phone, {
      kind: "text",
      body: "You're back with our assistant. Send a new order any time. 🌱",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
