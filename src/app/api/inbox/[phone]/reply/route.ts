import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { sendMessage } from "@/lib/whatsapp/client";
import { isWindowOpen } from "@/lib/whatsapp/window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/inbox/:phone/reply { text } — a staff member replies in the chat.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
) {
  const staff = await getStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { phone } = await params;
  const body = await req.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Message text required" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (!isWindowOpen(customer?.lastInboundAt)) {
    return NextResponse.json(
      { error: "The 24-hour window is closed — you can't send a free-form message. Use a template or wait for the customer to reply." },
      { status: 409 },
    );
  }

  const res = await sendMessage(phone, { kind: "text", body: text }).catch(() => ({
    sent: false as boolean,
    id: undefined as string | undefined,
  }));

  await prisma.messageLog.create({
    data: {
      phone,
      direction: "OUT",
      content: `${text}  — ${staff.name}`,
      messageType: "text",
      waMessageId: res.id,
      status: res.sent ? "sent" : null,
    },
  });

  // Mark who is handling this chat.
  await prisma.conversationSession
    .update({ where: { phone }, data: { assignedTo: staff.name } })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
