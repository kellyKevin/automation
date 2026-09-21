import { createHmac, timingSafeEqual } from "node:crypto";

// A stateless signed session token: "<staffId>.<expiryMs>.<hmac>". The HMAC is
// keyed with AUTH_SECRET, so the cookie cannot be forged. Kept dependency-free.

export const SESSION_COOKIE = "fc_staff";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret(): string {
  return process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
}

export function signSession(
  staffId: string,
  now: number = Date.now(),
  ttlMs: number = SESSION_TTL_MS,
): string {
  const payload = `${staffId}.${now + ttlMs}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySession(
  token: string | undefined | null,
  now: number = Date.now(),
): { staffId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [staffId, expStr, sig] = parts;
  const expected = createHmac("sha256", secret())
    .update(`${staffId}.${expStr}`)
    .digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return null;
  return { staffId };
}
