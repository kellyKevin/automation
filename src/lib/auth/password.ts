import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Password hashing with Node's built-in scrypt — no external dependency.
// Stored form: "scrypt$<saltHex>$<hashHex>".

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEYLEN).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
