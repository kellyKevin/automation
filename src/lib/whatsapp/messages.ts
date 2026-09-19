// Provider-agnostic outbound message shapes. The bot engine produces these;
// the WhatsApp client (client.ts) translates them into Cloud API JSON. Keeping
// the engine free of Cloud API details is what makes it unit-testable.

export interface Button {
  id: string;
  title: string; // WhatsApp limit: 20 chars
}

export interface ListRow {
  id: string;
  title: string; // WhatsApp limit: 24 chars
  description?: string; // WhatsApp limit: 72 chars
}

export type OutboundMessage =
  | { kind: "text"; body: string }
  | { kind: "buttons"; body: string; buttons: Button[] } // up to 3
  | { kind: "list"; body: string; button: string; rows: ListRow[] }; // up to 10

export function text(body: string): OutboundMessage {
  return { kind: "text", body };
}

export function buttons(body: string, btns: Button[]): OutboundMessage {
  if (btns.length > 3) {
    throw new Error("WhatsApp reply buttons are limited to 3");
  }
  return { kind: "buttons", body, buttons: btns.map(truncateButton) };
}

export function list(
  body: string,
  button: string,
  rows: ListRow[],
): OutboundMessage {
  if (rows.length > 10) {
    throw new Error("WhatsApp list messages are limited to 10 rows");
  }
  return { kind: "list", body, button, rows: rows.map(truncateRow) };
}

function truncateButton(b: Button): Button {
  return { id: b.id, title: b.title.slice(0, 20) };
}

function truncateRow(r: ListRow): ListRow {
  return {
    id: r.id,
    title: r.title.slice(0, 24),
    description: r.description?.slice(0, 72),
  };
}
