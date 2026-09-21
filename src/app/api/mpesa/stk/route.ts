import { NextRequest, NextResponse } from "next/server";
import { getStaff } from "@/lib/auth/staff";
import { initiateStkPush } from "@/lib/mpesa/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mpesa/stk { orderId } — staff trigger an STK push for an order.
export async function POST(req: NextRequest) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }
  const result = await initiateStkPush(orderId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, checkoutRequestId: result.checkoutRequestId });
}
