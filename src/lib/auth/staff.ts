import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "./session";

export type StaffRole = "owner" | "packer" | "dispatcher" | "rider";

export interface StaffSummary {
  id: string;
  name: string;
  role: string;
  phone: string;
}

/** Return the signed-in staff member from the session cookie, or null. */
export async function getStaff(): Promise<StaffSummary | null> {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const staff = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
  });
  if (!staff || !staff.active) return null;
  return { id: staff.id, name: staff.name, role: staff.role, phone: staff.phone };
}

/** Convenience for API routes: returns the staff, or null when unauthorised. */
export async function requireStaff(): Promise<StaffSummary | null> {
  return getStaff();
}
