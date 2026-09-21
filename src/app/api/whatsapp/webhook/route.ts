import { NextRequest, NextResponse } from "next/server";
import { verifySignature, verifyWebhookChallenge } from "@/lib/whatsapp/verify";
import { parseInbound, parseStatuses } from "@/lib/whatsapp/inbound";
import { processInbound, recordDeliveryStatuses } from "@/lib/bot/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Meta webhook verification handshake.
export async function GET(req: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";
  const challenge = verifyWebhookChallenge(req.nextUrl.searchParams, verifyToken);
  if (challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// POST: inbound messages and status callbacks.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Validate the signature when an app secret is configured.
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const signature = req.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, signature, appSecret)) {
      return new NextResponse("Invalid signature", { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Delivery-status receipts (sent/delivered/read/failed) for messages we sent.
  try {
    await recordDeliveryStatuses(parseStatuses(body));
  } catch (err) {
    console.error("[whatsapp] failed to record delivery statuses", err);
  }

  const messages = parseInbound(body);

  // Process sequentially. Always return 200 quickly so Meta doesn't retry;
  // errors are logged, not surfaced to the webhook caller.
  for (const msg of messages) {
    try {
      await processInbound(msg);
    } catch (err) {
      console.error("[whatsapp] failed to process message", msg.messageId, err);
    }
  }

  return NextResponse.json({ received: true });
}
