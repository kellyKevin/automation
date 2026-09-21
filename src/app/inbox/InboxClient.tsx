"use client";

import { useCallback, useEffect, useState } from "react";

interface Thread {
  phone: string;
  name: string | null;
  assignedTo: string | null;
  lastActivity: string;
}

interface Message {
  direction: string;
  content: string;
  type: string;
  status: string | null;
  at: string;
}

interface ThreadDetail {
  phone: string;
  name: string | null;
  handover: boolean;
  assignedTo: string | null;
  windowOpen: boolean;
  messages: Message[];
}

export default function InboxClient() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/inbox");
    if (res.ok) setThreads((await res.json()).threads ?? []);
  }, []);

  const loadDetail = useCallback(async (phone: string) => {
    const res = await fetch(`/api/inbox/${phone}`);
    if (res.ok) setDetail(await res.json());
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (selected) loadDetail(selected);
  }, [selected, loadDetail]);

  async function sendReply() {
    if (!selected || !text.trim()) return;
    setError(null);
    const res = await fetch(`/api/inbox/${selected}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to send");
      return;
    }
    setText("");
    loadDetail(selected);
  }

  async function resolve() {
    if (!selected) return;
    await fetch(`/api/inbox/${selected}/resolve`, { method: "POST" });
    setSelected(null);
    setDetail(null);
    loadThreads();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
      <div>
        {threads.length === 0 ? (
          <p className="muted">No chats waiting. 🎉</p>
        ) : (
          threads.map((t) => (
            <button
              key={t.phone}
              onClick={() => setSelected(t.phone)}
              className="card"
              style={{
                width: "100%",
                textAlign: "left",
                marginBottom: 8,
                cursor: "pointer",
                borderColor: selected === t.phone ? "var(--green)" : undefined,
              }}
            >
              <strong>{t.name ?? t.phone}</strong>
              <span className="muted">{t.phone}</span>
              {t.assignedTo ? <span className="muted">↳ {t.assignedTo}</span> : null}
            </button>
          ))
        )}
      </div>

      <div>
        {!detail ? (
          <p className="muted">Select a chat to view the conversation.</p>
        ) : (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{detail.name ?? detail.phone}</strong> <span className="muted">{detail.phone}</span>
              </div>
              <button className="btn btn-outline" onClick={resolve}>
                Resolve & resume bot
              </button>
            </div>

            <div
              style={{
                margin: "12px 0",
                maxHeight: 360,
                overflowY: "auto",
                display: "grid",
                gap: 6,
              }}
            >
              {detail.messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    justifySelf: m.direction === "IN" ? "start" : "end",
                    background: m.direction === "IN" ? "#eef4ea" : "var(--green)",
                    color: m.direction === "IN" ? "var(--ink)" : "#fff",
                    padding: "6px 10px",
                    borderRadius: 10,
                    maxWidth: "75%",
                    fontSize: "0.85rem",
                  }}
                >
                  {m.content}
                </div>
              ))}
            </div>

            {detail.windowOpen ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a reply…"
                  style={{ flex: 1 }}
                  onKeyDown={(e) => e.key === "Enter" && sendReply()}
                />
                <button className="btn btn-wa" onClick={sendReply}>
                  Send
                </button>
              </div>
            ) : (
              <p className="muted">
                The 24-hour window is closed — you can&apos;t send a free-form reply.
                Wait for the customer to message again.
              </p>
            )}
            {error ? <div style={{ color: "#b02a37", fontSize: "0.85rem", marginTop: 6 }}>{error}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
