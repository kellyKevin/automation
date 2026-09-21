import { NextRequest, NextResponse } from "next/server";
import { getStaff } from "@/lib/auth/staff";
import { sendMessage } from "@/lib/whatsapp/client";
import { whatsappConfigStatus } from "@/lib/whatsapp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/whatsapp/test { to } — staff: send a test message to confirm the
// number, token and phone id are wired up. Only works inside the recipient's
// 24-hour window (message them first from that number).
export async function POST(req: NextRequest) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!whatsappConfigStatus(process.env).canSend) {
    return NextResponse.json(
      { error: "WhatsApp is not configured — set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID." },
      { status: 400 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const to = typeof body?.to === "string" ? body.to.replace(/[^\d]/g, "") : "";
  if (to.length < 9) {
    return NextResponse.json({ error: "Enter a valid phone number (with country code)." }, { status: 400 });
  }

  try {
    const res = await sendMessage(to, {
      kind: "text",
      body: "✅ Farm City test message — your WhatsApp Cloud API connection is working.",
    });
    if (!res.sent) {
      return NextResponse.json(
        { error: "Message not sent — credentials look unset on the server." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, id: res.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 502 },
    );
  }
}
