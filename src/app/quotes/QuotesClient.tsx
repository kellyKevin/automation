"use client";

import { useEffect, useState } from "react";

interface Quote {
  id: string;
  createdAt: string;
  status: string;
  type: string | null;
  organisation: string | null;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  itemsSummary: string;
  quantity: string | null;
  frequency: string | null;
  location: string | null;
  notes: string | null;
  assignedTo: string | null;
  quotedAmount: number | null;
}

const STATUSES = ["NEW", "QUOTED", "WON", "LOST"];
const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  QUOTED: "Quoted",
  WON: "Won",
  LOST: "Lost",
};

export default function QuotesClient({ staffName }: { staffName: string }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch("/api/quotes");
    if (res.ok) setQuotes((await res.json()).quotes ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (res.ok) load();
  }

  if (loading) return <p>Loading quotes…</p>;

  const visible = quotes.filter((q) => !statusFilter || q.status === statusFilter);

  return (
    <>
      <div style={{ display: "flex", gap: 8, margin: "8px 0 12px", alignItems: "center" }}>
        <span className="muted">Filter:</span>
        <button
          className="btn btn-outline"
          onClick={() => setStatusFilter("")}
          style={{ borderColor: statusFilter === "" ? "var(--green)" : undefined }}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            className="btn btn-outline"
            onClick={() => setStatusFilter(s)}
            style={{ borderColor: statusFilter === s ? "var(--green)" : undefined }}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="muted">No quote requests yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {visible.map((q) => (
            <div key={q.id} className="card" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                <div>
                  <strong>{q.organisation ?? q.contactPerson ?? "—"}</strong>{" "}
                  {q.type ? <span className="muted">({q.type})</span> : null}
                  <br />
                  <span className="muted">
                    {q.contactPerson ? `${q.contactPerson} · ` : ""}
                    {q.phone}
                    {q.email ? ` · ${q.email}` : ""}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: q.status === "WON" ? "#e3f4e1" : q.status === "LOST" ? "#f6e2e2" : "#eef4ea",
                    }}
                  >
                    {STATUS_LABEL[q.status] ?? q.status}
                  </span>
                  <br />
                  <span className="muted" style={{ fontSize: "0.75rem" }}>
                    {new Date(q.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: "0.9rem" }}>
                <strong>Items:</strong> {q.itemsSummary}
                {q.quantity ? <> · <strong>Qty:</strong> {q.quantity}</> : null}
                {q.frequency ? <> · <strong>Frequency:</strong> {q.frequency}</> : null}
              </div>
              {q.location ? (
                <div className="muted" style={{ fontSize: "0.85rem" }}>📍 {q.location}</div>
              ) : null}
              {q.notes ? (
                <div className="muted" style={{ fontSize: "0.85rem" }}>📝 {q.notes}</div>
              ) : null}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 4 }}>
                <select
                  value={q.status}
                  onChange={(e) => patch(q.id, { status: e.target.value })}
                  disabled={busy === q.id}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>

                {q.assignedTo ? (
                  <span className="muted" style={{ fontSize: "0.85rem" }}>↳ {q.assignedTo}</span>
                ) : (
                  <button
                    className="btn btn-outline"
                    disabled={busy === q.id}
                    onClick={() => patch(q.id, { assignedTo: staffName })}
                  >
                    Assign to me
                  </button>
                )}

                <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    type="number"
                    min={0}
                    placeholder="Quoted KSh"
                    value={amountDraft[q.id] ?? (q.quotedAmount != null ? String(q.quotedAmount) : "")}
                    onChange={(e) => setAmountDraft((d) => ({ ...d, [q.id]: e.target.value }))}
                    style={{ width: 120 }}
                  />
                  <button
                    className="btn btn-outline"
                    disabled={busy === q.id}
                    onClick={() =>
                      patch(q.id, { quotedAmount: Number(amountDraft[q.id] ?? q.quotedAmount ?? 0) })
                    }
                  >
                    Save amount
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
