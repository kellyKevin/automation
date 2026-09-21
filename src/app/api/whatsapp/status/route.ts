import { NextResponse } from "next/server";
import { getStaff } from "@/lib/auth/staff";
import { whatsappConfigStatus } from "@/lib/whatsapp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/whatsapp/status — staff: which Cloud API credentials are configured
// (booleans only; secret values are never returned).
export async function GET() {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ status: whatsappConfigStatus(process.env) });
}
