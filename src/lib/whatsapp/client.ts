import type { OutboundMessage } from "./messages";
import { DEFAULT_TEMPLATE_LANGUAGE, type TemplateName } from "./templates";

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

/** Build a Cloud API template message payload (used outside the 24h window). */
export function toTemplatePayload(
  to: string,
  name: TemplateName,
  bodyParams: string[] = [],
  language: string = DEFAULT_TEMPLATE_LANGUAGE,
): Record<string, unknown> {
  const components =
    bodyParams.length > 0
      ? [
          {
            type: "body",
            parameters: bodyParams.map((text) => ({ type: "text", text })),
          },
        ]
      : [];
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name, language: { code: language }, components },
  };
}

/** POST a payload to the Cloud API, or dry-run when no credentials are set. */
async function postToCloud(
  payload: Record<string, unknown>,
  cfg: WhatsAppConfig | null,
): Promise<{ sent: boolean; id?: string }> {
  if (!cfg) {
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
  const data = (await res.json().catch(() => ({}))) as {
    messages?: { id?: string }[];
  };
  return { sent: true, id: data?.messages?.[0]?.id };
}

/**
 * Send a free-form message via the WhatsApp Cloud API (only valid inside the
 * 24-hour window). When credentials are not configured (local dev), it logs the
 * payload and resolves without error, so the flow can be exercised offline.
 */
export async function sendMessage(
  to: string,
  msg: OutboundMessage,
  cfg: WhatsAppConfig | null = configFromEnv(),
): Promise<{ sent: boolean; id?: string }> {
  return postToCloud(toCloudApiPayload(to, msg), cfg);
}

/** Send a pre-approved template message (valid outside the 24-hour window). */
export async function sendTemplate(
  to: string,
  name: TemplateName,
  bodyParams: string[] = [],
  language: string = DEFAULT_TEMPLATE_LANGUAGE,
  cfg: WhatsAppConfig | null = configFromEnv(),
): Promise<{ sent: boolean; id?: string }> {
  return postToCloud(toTemplatePayload(to, name, bodyParams, language), cfg);
}
