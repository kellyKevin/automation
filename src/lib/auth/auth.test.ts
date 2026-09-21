import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { signSession, verifySession, SESSION_TTL_MS } from "./session";

describe("password hashing", () => {
  it("verifies the correct password and rejects wrong ones", () => {
    const stored = hashPassword("s3cret-pass");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("s3cret-pass", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
  });
  it("produces a different salt each time", () => {
    expect(hashPassword("x")).not.toBe(hashPassword("x"));
  });
  it("rejects malformed or missing stored hashes", () => {
    expect(verifyPassword("x", null)).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "bcrypt$foo$bar")).toBe(false);
  });
});

describe("session token", () => {
  const now = 1_000_000_000_000;
  it("round-trips a valid token", () => {
    const token = signSession("staff123", now);
    expect(verifySession(token, now + 1000)).toEqual({ staffId: "staff123" });
  });
  it("rejects an expired token", () => {
    const token = signSession("staff123", now);
    expect(verifySession(token, now + SESSION_TTL_MS + 1)).toBeNull();
  });
  it("rejects a tampered token", () => {
    const token = signSession("staff123", now);
    expect(verifySession(token.slice(0, -2) + "xy", now + 1000)).toBeNull();
    expect(verifySession("staff999." + (now + SESSION_TTL_MS) + ".deadbeef", now)).toBeNull();
  });
  it("rejects empty / malformed input", () => {
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession("notatoken")).toBeNull();
  });
});
