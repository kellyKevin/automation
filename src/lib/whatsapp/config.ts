// Reports which WhatsApp Cloud API credentials are configured, so the dashboard
// can guide the Meta setup (Part 4) without ever exposing secret values.
// Pure: it takes an env bag and returns booleans + safe-to-show config only.

export interface WhatsAppConfigStatus {
  /** Which required/optional env vars are present (never their values). */
  vars: {
    WHATSAPP_TOKEN: boolean;
    WHATSAPP_PHONE_NUMBER_ID: boolean;
    WHATSAPP_VERIFY_TOKEN: boolean;
    WHATSAPP_APP_SECRET: boolean;
    TEAM_ALERT_WHATSAPP_NUMBER: boolean;
  };
  /** Non-secret Graph API version the client will call. */
  graphVersion: string;
  /** Verify token set → the GET webhook handshake can succeed. */
  canReceive: boolean;
  /** Token + phone number id set → the bot can send messages. */
  canSend: boolean;
  /** App secret set → inbound webhook signatures are enforced. */
  signatureEnforced: boolean;
  /** Team alert number set → handovers/quotes notify staff. */
  teamAlerts: boolean;
  /** Fully wired for two-way messaging. */
  ready: boolean;
}

type Env = Record<string, string | undefined>;

const has = (v: string | undefined): boolean => typeof v === "string" && v.trim().length > 0;

export function whatsappConfigStatus(env: Env): WhatsAppConfigStatus {
  const vars = {
    WHATSAPP_TOKEN: has(env.WHATSAPP_TOKEN),
    WHATSAPP_PHONE_NUMBER_ID: has(env.WHATSAPP_PHONE_NUMBER_ID),
    WHATSAPP_VERIFY_TOKEN: has(env.WHATSAPP_VERIFY_TOKEN),
    WHATSAPP_APP_SECRET: has(env.WHATSAPP_APP_SECRET),
    TEAM_ALERT_WHATSAPP_NUMBER: has(env.TEAM_ALERT_WHATSAPP_NUMBER),
  };
  const canReceive = vars.WHATSAPP_VERIFY_TOKEN;
  const canSend = vars.WHATSAPP_TOKEN && vars.WHATSAPP_PHONE_NUMBER_ID;
  return {
    vars,
    graphVersion: env.WHATSAPP_GRAPH_VERSION || "v21.0",
    canReceive,
    canSend,
    signatureEnforced: vars.WHATSAPP_APP_SECRET,
    teamAlerts: vars.TEAM_ALERT_WHATSAPP_NUMBER,
    ready: canReceive && canSend,
  };
}
