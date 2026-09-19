import crypto from "node:crypto";

/**
 * Validate Meta's X-Hub-Signature-256 header against the raw request body.
 * The header looks like "sha256=<hex>". Returns true when it matches the
 * HMAC-SHA256 of the raw body keyed with the app secret.
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Handle the GET webhook verification handshake. Returns the challenge string
 * to echo back when the token matches, or null to reject with 403.
 */
export function verifyWebhookChallenge(
  params: URLSearchParams,
  verifyToken: string,
): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return challenge;
  }
  return null;
}
