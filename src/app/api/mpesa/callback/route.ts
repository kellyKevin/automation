import { NextRequest, NextResponse } from "next/server";
import { parseStkCallback } from "@/lib/mpesa/callback";
import { handleStkCallback } from "@/lib/mpesa/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mpesa/callback — Daraja calls this with the STK push result.
// Always acknowledge with ResultCode 0 so Safaricom doesn't retry; failures are
// logged. Optionally protect the URL with a hard-to-guess CRON_SECRET path or a
// query token; matching is done by CheckoutRequestID.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const result = parseStkCallback(body);
    if (result) await handleStkCallback(result);
  } catch (err) {
    console.error("[mpesa] callback handling failed", err);
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
