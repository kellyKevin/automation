import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { signSession, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/login { phone, password } -> sets the staff session cookie.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!phone || !password) {
    return NextResponse.json({ error: "Phone and password required" }, { status: 400 });
  }

  const staff = await prisma.staffUser.findUnique({ where: { phone } });
  if (!staff || !staff.active || !verifyPassword(password, staff.passwordHash)) {
    return NextResponse.json({ error: "Invalid phone or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, name: staff.name, role: staff.role });
  res.cookies.set(SESSION_COOKIE, signSession(staff.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
