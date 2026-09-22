import { describe, it, expect, afterEach } from "vitest";
import { cronSecretOk } from "./cron";

function req(headers: Record<string, string>): { headers: { get(k: string): string | null } } {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: { get: (k: string) => lower[k.toLowerCase()] ?? null } };
}

const original = process.env.CRON_SECRET;
afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

describe("cronSecretOk", () => {
  it("accepts the x-cron-secret header", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(cronSecretOk(req({ "x-cron-secret": "s3cret" }) as never)).toBe(true);
  });

  it("accepts the Vercel Bearer header", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(cronSecretOk(req({ authorization: "Bearer s3cret" }) as never)).toBe(true);
  });

  it("rejects a wrong or missing secret", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(cronSecretOk(req({ "x-cron-secret": "nope" }) as never)).toBe(false);
    expect(cronSecretOk(req({}) as never)).toBe(false);
  });

  it("is closed when no secret is configured", () => {
    delete process.env.CRON_SECRET;
    expect(cronSecretOk(req({ authorization: "Bearer anything" }) as never)).toBe(false);
  });
});
