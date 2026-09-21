"use client";

import { useEffect, useState } from "react";

interface Status {
  vars: Record<string, boolean>;
  graphVersion: string;
  canReceive: boolean;
  canSend: boolean;
  signatureEnforced: boolean;
  teamAlerts: boolean;
  ready: boolean;
}

const VAR_LABELS: { key: string; label: string; hint: string }[] = [
  { key: "WHATSAPP_TOKEN", label: "Access token", hint: "Permanent System User token" },
  { key: "WHATSAPP_PHONE_NUMBER_ID", label: "Phone number ID", hint: "From the WhatsApp > API setup screen" },
  { key: "WHATSAPP_VERIFY_TOKEN", label: "Verify token", hint: "Any secret string; paste the same into Meta" },
  { key: "WHATSAPP_APP_SECRET", label: "App secret", hint: "Enforces inbound webhook signatures" },
  { key: "TEAM_ALERT_WHATSAPP_NUMBER", label: "Team alert number", hint: "Where new orders/handovers are announced" },
];

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: ok ? "#2e7d32" : "#c0c0c0",
        marginRight: 8,
      }}
    />
  );
}

export default function ConnectClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function load() {
    const res = await fetch("/api/whatsapp/status");
    if (res.ok) setStatus((await res.json()).status);
    setLoading(false);
  }
  useEffect(() => {
    load();
    if (typeof window !== "undefined") {
      setWebhookUrl(`${window.location.origin}/api/whatsapp/webhook`);
    }
  }, []);

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the field is selectable */
    }
  }

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    const res = await fetch("/api/whatsapp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    setResult(
      res.ok
        ? { ok: true, msg: "Sent! Check that WhatsApp number." }
        : { ok: false, msg: data.error ?? "Send failed" },
    );
  }

  if (loading) return <p>Checking connection…</p>;
  if (!status) return <p className="muted">Could not load connection status.</p>;

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <div className="card">
        <strong>
          {status.ready ? "✅ Connected — two-way messaging is live" : "⚠️ Not fully connected yet"}
        </strong>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {status.ready
            ? "The bot can receive and send WhatsApp messages."
            : "Fill the missing credentials below (server environment), then redeploy."}
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 8 }}>
        <strong>Credentials</strong>
        {VAR_LABELS.map((v) => (
          <div key={v.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>
              <Dot ok={!!status.vars[v.key]} />
              {v.label}
              <br />
              <span className="muted" style={{ fontSize: "0.8rem", marginLeft: 18 }}>
                {v.hint} — <code>{v.key}</code>
              </span>
            </span>
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              {status.vars[v.key] ? "set" : "missing"}
            </span>
          </div>
        ))}
        <div className="muted" style={{ fontSize: "0.8rem" }}>
          Graph API version: <code>{status.graphVersion}</code> ·{" "}
          Signatures {status.signatureEnforced ? "enforced" : "not enforced"}
        </div>
      </div>

      <div className="card" style={{ display: "grid", gap: 8 }}>
        <strong>Webhook</strong>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          In Meta → WhatsApp → Configuration, set the Callback URL to this, and the
          Verify token to your <code>WHATSAPP_VERIFY_TOKEN</code>. Subscribe to the{" "}
          <code>messages</code> field.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input readOnly value={webhookUrl} style={{ flex: 1, fontFamily: "monospace" }} onFocus={(e) => e.target.select()} />
          <button className="btn btn-outline" onClick={copyWebhook} type="button">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <form onSubmit={sendTest} className="card" style={{ display: "grid", gap: 8 }}>
        <strong>Send a test message</strong>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Message the business number from your phone first (to open the 24-hour
          window), then send a test here.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="2547XXXXXXXX"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn-wa" type="submit" disabled={sending || !status.canSend}>
            {sending ? "Sending…" : "Send test"}
          </button>
        </div>
        {!status.canSend ? (
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            Add the access token and phone number ID to enable sending.
          </span>
        ) : null}
        {result ? (
          <div style={{ color: result.ok ? "#2e7d32" : "#b02a37", fontSize: "0.85rem" }}>{result.msg}</div>
        ) : null}
      </form>
    </div>
  );
}
