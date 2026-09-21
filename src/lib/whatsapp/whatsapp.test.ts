import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifySignature, verifyWebhookChallenge } from "./verify";
import { parseInbound, parseStatuses } from "./inbound";
import { toCloudApiPayload, toTemplatePayload } from "./client";
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
    expect(toCloudApiPayload("254", buttons("pick", [{ id: "a", title: "A" }]))).toMatchObject({
      type: "interactive",
      interactive: {
        type: "button",
        action: { buttons: [{ reply: { id: "a", title: "A" } }] },
      },
    });
  });

  it("builds a list payload", () => {
    expect(toCloudApiPayload("254", list("where", "Choose", [{ id: "z", title: "Zone" }]))).toMatchObject({
      interactive: {
        type: "list",
        action: { sections: [{ rows: [{ id: "z" }] }] },
      },
    });
  });
});

describe("parseStatuses", () => {
  it("extracts delivery receipts", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: "wamid.9", status: "delivered", recipient_id: "254712345678", timestamp: "123" },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseStatuses(body)).toEqual([
      { id: "wamid.9", status: "delivered", recipient: "254712345678", timestamp: "123" },
    ]);
  });

  it("returns [] for a message payload", () => {
    const body = {
      entry: [{ changes: [{ value: { messages: [{ from: "1", id: "x", type: "text" }] } }] }],
    };
    expect(parseStatuses(body)).toEqual([]);
  });
});

describe("toTemplatePayload", () => {
  it("builds a template payload with ordered body params", () => {
    expect(toTemplatePayload("254", "payment_received", ["FC-0007"])).toMatchObject({
      messaging_product: "whatsapp",
      to: "254",
      type: "template",
      template: {
        name: "payment_received",
        language: { code: "en" },
        components: [{ type: "body", parameters: [{ type: "text", text: "FC-0007" }] }],
      },
    });
  });

  it("omits components when the template has no variables", () => {
    expect(toTemplatePayload("254", "order_delivered")).toMatchObject({
      type: "template",
      template: { name: "order_delivered", components: [] },
    });
  });
});
