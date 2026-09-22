import { NextRequest, NextResponse } from "next/server";
import { getStaff } from "@/lib/auth/staff";
import { cronSecretOk } from "@/lib/jobs/cron";
import { releaseUnpaidOrders } from "@/lib/orders/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lapse unpaid orders past the time limit and release their reserved stock
// (Part 10). Authorised by a cron secret (x-cron-secret or Vercel's
// Authorization: Bearer) or a signed-in staff member. GET is for Vercel Cron;
// POST is for the dashboard.
async function handle(req: NextRequest) {
  if (!cronSecretOk(req) && !(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const minutes = Number(process.env.UNPAID_REMINDER_MINUTES || 120);
  const released = await releaseUnpaidOrders(minutes);
  return NextResponse.json({ released, olderThanMinutes: minutes });
}

export const GET = handle;
export const POST = handle;
