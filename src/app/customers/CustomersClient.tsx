"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

interface CustomerRow {
  phone: string;
  name: string | null;
  type: string;
  optedOut: boolean;
  lastInboundAt: string | null;
  orders: number;
  paidOrders: number;
  totalSpent: number;
  outstanding: number;
  lastOrderAt: string | null;
}
interface OrderRow {
  number: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  itemCount: number;
}
interface QuoteRow {
  id: string;
  status: string;
  itemsSummary: string;
  quotedAmount: number | null;
  createdAt: string;
}
interface Detail {
  phone: string;
  name: string | null;
  type: string;
  defaultAddress: string | null;
  optedOut: boolean;
  firstOrderAt: string | null;
  windowOpen: boolean;
  stats: { orders: number; paidOrders: number; totalSpent: number; outstanding: number };
  orders: OrderRow[];
  quotes: QuoteRow[];
}

const ksh = (n: number) => `KSh ${Math.round(n).toLocaleString()}`;
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

export default function CustomersClient() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) setRows((await res.json()).customers ?? []);
    setLoading(false);
  }, [q]);

  // Debounce the search a touch.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function toggle(phone: string) {
    if (open === phone) {
      setOpen(null);
      setDetail(null);
      return;
    }
    setOpen(phone);
    setDetail(null);
    const res = await fetch(`/api/customers/${phone}`);
    if (res.ok) setDetail((await res.json()).customer);
  }

  return (
    <>
      <input
        placeholder="Search name or phone…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ margin: "8px 0 12px", width: 320, maxWidth: "100%" }}
      />

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No customers found.</p>
      ) : (
        <table className="orders">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Type</th>
              <th>Orders</th>
              <th>Spent</th>
              <th>Outstanding</th>
              <th>Last order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <Fragment key={c.phone}>
                <tr>
                  <td>
                    <strong>{c.name ?? "—"}</strong>
                    {c.optedOut ? <span className="muted"> · opted out</span> : null}
                    <br />
                    <span className="muted">{c.phone}</span>
                  </td>
                  <td>{c.type}</td>
                  <td>{c.orders}</td>
                  <td>{ksh(c.totalSpent)}</td>
                  <td>{c.outstanding > 0 ? ksh(c.outstanding) : "—"}</td>
                  <td className="muted" style={{ fontSize: "0.85rem" }}>{date(c.lastOrderAt)}</td>
                  <td>
                    <button className="btn btn-outline" onClick={() => toggle(c.phone)}>
                      {open === c.phone ? "Close" : "View"}
                    </button>
                  </td>
                </tr>
                {open === c.phone ? (
                  <tr>
                    <td colSpan={7} style={{ background: "#f7f9f5" }}>
                      {!detail ? (
                        <p className="muted">Loading…</p>
                      ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.85rem" }}>
                            <span>📦 {detail.stats.orders} orders</span>
                            <span>💰 {ksh(detail.stats.totalSpent)} collected</span>
                            {detail.stats.outstanding > 0 ? <span>⏳ {ksh(detail.stats.outstanding)} outstanding</span> : null}
                            <span>{detail.windowOpen ? "🟢 24h window open" : "⚪ window closed"}</span>
                            {detail.defaultAddress ? <span>📍 {detail.defaultAddress}</span> : null}
                          </div>

                          {detail.orders.length > 0 ? (
                            <div>
                              <strong>Orders</strong>
                              <table className="orders" style={{ marginTop: 4 }}>
                                <tbody>
                                  {detail.orders.map((o) => (
                                    <tr key={o.number}>
                                      <td><strong>{o.number}</strong></td>
                                      <td>{o.status}</td>
                                      <td>{o.paymentStatus}</td>
                                      <td>{o.itemCount} item(s)</td>
                                      <td>{ksh(o.total)}</td>
                                      <td className="muted" style={{ fontSize: "0.8rem" }}>{date(o.createdAt)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <span className="muted">No orders yet.</span>
                          )}

                          {detail.quotes.length > 0 ? (
                            <div>
                              <strong>Bulk quotes</strong>
                              <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: "0.85rem" }}>
                                {detail.quotes.map((qt) => (
                                  <li key={qt.id}>
                                    {qt.status} — {qt.itemsSummary}
                                    {qt.quotedAmount != null ? ` (${ksh(qt.quotedAmount)})` : ""}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
