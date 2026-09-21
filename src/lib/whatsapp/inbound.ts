// Normalise a Meta WhatsApp Cloud API webhook payload into a simple event the
// bot engine understands, decoupling the engine from Meta's nested JSON shape.

export interface InboundMessage {
  /** Sender's WhatsApp number, no '+' (e.g. 254712345678). */
  from: string;
  /** WhatsApp message id, for de-duplication. */
  messageId: string;
  /** Contact profile name, when WhatsApp provides it. */
  profileName?: string;
  /** For text: the body. For an interactive reply: the chosen option's title. */
  text?: string;
  /** The id of a tapped reply button or selected list row, if any. */
  replyId?: string;
  /** Message type: text | interactive | image | audio | ... */
  type: string;
}

// Minimal shapes for the parts of Meta's webhook payload we read.
interface RawReply {
  id?: string;
  title?: string;
}
interface RawMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  interactive?: { button_reply?: RawReply; list_reply?: RawReply };
  button?: { text?: string; payload?: string };
}
interface RawStatus {
  id?: string;
  status?: string;
  recipient_id?: string;
  timestamp?: string;
}
interface RawValue {
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: RawMessage[];
  statuses?: RawStatus[];
}
interface RawBody {
  entry?: { changes?: { value?: RawValue }[] }[];
}

/** A delivery-status receipt for a message we sent (sent/delivered/read/failed). */
export interface StatusReceipt {
  /** The Cloud API message id (matches MessageLog.waMessageId). */
  id: string;
  status: string;
  recipient?: string;
  timestamp?: string;
}

/** Extract delivery-status receipts from a webhook body (empty for message
 * payloads). Lets us record whether our outbound messages were delivered. */
export function parseStatuses(body: unknown): StatusReceipt[] {
  const out: StatusReceipt[] = [];
  const entries = (body as RawBody)?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      for (const s of change?.value?.statuses ?? []) {
        if (s?.id && s?.status) {
          out.push({
            id: s.id,
            status: s.status,
            recipient: s.recipient_id,
            timestamp: s.timestamp,
          });
        }
      }
    }
  }
  return out;
}

/** Extract inbound messages from a webhook body. Usually 0 or 1, but the API
 * batches, so return an array. Status-only callbacks yield []. */
export function parseInbound(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (body as RawBody)?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const contacts = value?.contacts ?? [];
      const profileByWaId = new Map<string, string>();
      for (const c of contacts) {
        if (c?.wa_id && c?.profile?.name) {
          profileByWaId.set(c.wa_id, c.profile.name);
        }
      }

      for (const m of value?.messages ?? []) {
        const from: string = m?.from ?? "";
        if (!from) continue;
        const base: InboundMessage = {
          from,
          messageId: m?.id ?? "",
          profileName: profileByWaId.get(from),
          type: m?.type ?? "unknown",
        };

        if (m.type === "text") {
          base.text = m.text?.body ?? "";
        } else if (m.type === "interactive") {
          const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
          if (reply) {
            base.replyId = reply.id;
            base.text = reply.title;
          }
        } else if (m.type === "button") {
          // template quick-reply button
          base.text = m.button?.text;
          base.replyId = m.button?.payload;
        }

        out.push(base);
      }
    }
  }
  return out;
}
