import type { OutboundMessage } from "./messages";

export interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  graphVersion?: string;
}

function configFromEnv(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || "v21.0",
  };
}

/** Translate a provider-agnostic OutboundMessage into a Cloud API payload. */
export function toCloudApiPayload(
  to: string,
  msg: OutboundMessage,
): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", to } as Record<string, unknown>;

  switch (msg.kind) {
    case "text":
      return { ...base, type: "text", text: { body: msg.body } };

    case "buttons":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: msg.body },
          action: {
            buttons: msg.buttons.map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      };

    case "list":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: msg.body },
          action: {
            button: msg.button,
            sections: [
              {
                title: "Options",
                rows: msg.rows.map((r) => ({
                  id: r.id,
                  title: r.title,
                  description: r.description,
                })),
              },
            ],
          },
        },
      };
  }
}

/**
 * Send a message via the WhatsApp Cloud API. When credentials are not
 * configured (local dev), it logs the payload and resolves without error, so
 * the whole flow can be exercised without a live Meta app.
 */
export async function sendMessage(
  to: string,
  msg: OutboundMessage,
  cfg: WhatsAppConfig | null = configFromEnv(),
): Promise<{ sent: boolean; id?: string }> {
  const payload = toCloudApiPayload(to, msg);

  if (!cfg) {
    // eslint-disable-next-line no-console
    console.info("[whatsapp:dry-run]", JSON.stringify(payload));
    return { sent: false };
  }

  const url = `https://graph.facebook.com/${cfg.graphVersion}/${cfg.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp send failed (${res.status}): ${detail}`);
  }
  const data = (await res.json().catch(() => ({}))) as any;
  return { sent: true, id: data?.messages?.[0]?.id };
}
