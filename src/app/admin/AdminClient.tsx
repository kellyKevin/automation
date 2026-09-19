"use client";

import { useEffect, useState } from "react";

const NEXT_STATUS: Record<string, string[]> = {
  NEW: ["CONFIRMED", "CANCELLED", "ON_HOLD"],
  CONFIRMED: ["PAID", "PACKED", "CANCELLED", "ON_HOLD"],
  PAID: ["PACKED", "CANCELLED", "ON_HOLD"],
  PACKED: ["OUT_FOR_DELIVERY", "DISPATCHED", "CANCELLED", "ON_HOLD"],
  OUT_FOR_DELIVERY: ["DELIVERED", "ON_HOLD"],
  DISPATCHED: ["DELIVERED", "ON_HOLD"],
  DELIVERED: [],
  CANCELLED: [],
  ON_HOLD: ["CONFIRMED", "PAID", "PACKED", "CANCELLED"],
};

interface Order {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  customer?: { name?: string | null; phone: string } | null;
  items: { productName: string; quantity: number; unit: string }[];
}

export default function AdminClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      setOrders(data.orders ?? []);
      setError(null);
    } catch {
      setError("Could not load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function advance(id: string, status: string) {
    const res = await fetch(`/api/orders/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, changedBy: "admin-panel" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to update status");
      return;
    }
    load();
  }

  if (loading) return <p>Loading orders…</p>;
  if (error) return <p>{error}</p>;
  if (orders.length === 0) return <p className="muted">No orders yet.</p>;

  return (
    <table className="orders">
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Items</th>
          <th>Total</th>
          <th>Payment</th>
          <th>Status</th>
          <th>Advance</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id}>
            <td>
              <strong>{o.number}</strong>
              <br />
              <span className="muted">
                {new Date(o.createdAt).toLocaleString()}
              </span>
            </td>
            <td>
              {o.customer?.name ?? "—"}
              <br />
              <span className="muted">{o.customer?.phone}</span>
            </td>
            <td>
              {o.items.map((it, i) => (
                <div key={i}>
                  {it.productName} × {it.quantity} {it.unit}
                </div>
              ))}
            </td>
            <td>KES {o.total.toLocaleString()}</td>
            <td>{o.paymentStatus}</td>
            <td>
              <span className="badge">{o.status}</span>
            </td>
            <td>
              {(NEXT_STATUS[o.status] ?? []).length === 0 ? (
                <span className="muted">—</span>
              ) : (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) advance(o.id, e.target.value);
                  }}
                >
                  <option value="">Change to…</option>
                  {(NEXT_STATUS[o.status] ?? []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
