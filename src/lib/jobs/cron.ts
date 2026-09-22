import type { NextRequest } from "next/server";

/**
 * Is this request an authorised cron trigger? Accepts either our own
 * `x-cron-secret` header or the `Authorization: Bearer <secret>` header that
 * Vercel Cron sends when a CRON_SECRET env var is set. Returns false when no
 * secret is configured, so cron endpoints are never open by accident.
 */
export function cronSecretOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization");
  return header === secret || auth === `Bearer ${secret}`;
}
