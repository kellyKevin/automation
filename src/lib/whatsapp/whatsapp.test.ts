import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifySignature, verifyWebhookChallenge } from "./verify";
import { parseInbound } from "./inbound";
import { toCloudApiPayload } from "./client";
import { text, buttons, list } from "./messages";

describe("verifySignature", () => {
  const secret = "s3cret";
  const body = JSON.stringify({ hello: "world" });
  const good = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a valid signature", () => {
    expect(verifySignature(body, good, secret)).toBe(true);
  });
  it("rejects a tampered body or missing header", () => {
    expect(verifySignature(body + "x", good, secret)).toBe(false);
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, "sha256=deadbeef", secret)).toBe(false);
  });
});

describe("verifyWebhookChallenge", () => {
  it("echoes the challenge when the token matches", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "tok",
      "hub.challenge": "12345",
    });
    expect(verifyWebhookChallenge(params, "tok")).toBe("12345");
    expect(verifyWebhookChallenge(params, "wrong")).toBeNull();
  });
});

describe("parseInbound", () => {
  it("extracts a text message with profile name", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "254712345678", profile: { name: "Grace" } }],
                messages: [
                  { from: "254712345678", id: "wamid.1", type: "text", text: { body: "hi" } },
                ],
              },
            },
          ],
        },
      ],
    };
    const [m] = parseInbound(body);
    expect(m).toMatchObject({ from: "254712345678", profileName: "Grace", text: "hi", type: "text" });
  });

  it("extracts an interactive button reply id", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "254712345678",
                    id: "wamid.2",
                    type: "interactive",
                    interactive: { button_reply: { id: "items_yes", title: "Yes" } },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const [m] = parseInbound(body);
    expect(m.replyId).toBe("items_yes");
    expect(m.text).toBe("Yes");
  });

  it("returns [] for status-only callbacks", () => {
    expect(parseInbound({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual([]);
  });
});

describe("toCloudApiPayload", () => {
  it("builds a text payload", () => {
    expect(toCloudApiPayload("254", text("hello"))).toMatchObject({
      messaging_product: "whatsapp",
      to: "254",
      type: "text",
      text: { body: "hello" },
    });
  });

  it("builds an interactive buttons payload", () => {
    const p: any = toCloudApiPayload("254", buttons("pick", [{ id: "a", title: "A" }]));
    expect(p.type).toBe("interactive");
    expect(p.interactive.type).toBe("button");
    expect(p.interactive.action.buttons[0].reply).toEqual({ id: "a", title: "A" });
  });

  it("builds a list payload", () => {
    const p: any = toCloudApiPayload("254", list("where", "Choose", [{ id: "z", title: "Zone" }]));
    expect(p.interactive.type).toBe("list");
    expect(p.interactive.action.sections[0].rows[0].id).toBe("z");
  });
});
