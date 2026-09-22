import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/standing-orders/:id { active?, nextRunAt? } — staff: pause/resume
// or reschedule a standing order.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const data: { active?: boolean; nextRunAt?: Date } = {};
  if (typeof b?.active === "boolean") data.active = b.active;
  if (typeof b?.nextRunAt === "string") {
    const d = new Date(b.nextRunAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    data.nextRunAt = d;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const so = await prisma.standingOrder.update({ where: { id }, data }).catch(() => null);
  if (!so) return NextResponse.json({ error: "Standing order not found" }, { status: 404 });
  return NextResponse.json({ standingOrder: so });
}

// DELETE /api/standing-orders/:id — staff: remove a standing order.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await prisma.standingOrder.delete({ where: { id } }).then(() => true).catch(() => false);
  if (!ok) return NextResponse.json({ error: "Standing order not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
