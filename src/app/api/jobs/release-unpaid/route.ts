import { NextRequest, NextResponse } from "next/server";
import { getStaff } from "@/lib/auth/staff";
import { releaseUnpaidOrders } from "@/lib/orders/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/jobs/release-unpaid — lapse unpaid orders past the time limit and
// release their reserved stock (Part 10). Authorised by a cron secret header
// (x-cron-secret === CRON_SECRET) or by a signed-in staff member, so it can be
// wired to a Vercel Cron or triggered from the dashboard.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  const authorised = (!!secret && provided === secret) || (await getStaff()) !== null;
  if (!authorised) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const minutes = Number(process.env.UNPAID_REMINDER_MINUTES || 120);
  const released = await releaseUnpaidOrders(minutes);
  return NextResponse.json({ released, olderThanMinutes: minutes });
}
