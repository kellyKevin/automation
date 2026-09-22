"use client";

import { useCallback, useEffect, useState } from "react";

interface Item {
  productName: string;
  quantity: number;
  unit: string;
}
interface Order {
  number: string;
  status: string;
  paymentStatus: string;
  total: number;
  origin: string;
  method: string | null;
  zoneName: string | null;
  county: string | null;
  town: string | null;
  address: string | null;
  landmark: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  assignedTo: string | null;
  trackingNumber: string | null;
  items: Item[];
}
interface Group {
  key: string;
  label: string;
  orders: Order[];
}
interface Data {
  statuses: string[];
  count: number;
  rider: Group[];
  courier: Group[];
}

const FILTERS: { v: string; l: string }[] = [
  { v: "", l: "All being fulfilled" },
  { v: "PACKED", l: "Packed" },
  { v: "PAID,CONFIRMED", l: "To pack" },
  { v: "OUT_FOR_DELIVERY,DISPATCHED", l: "On the way" },
];

const ksh = (n: number) => `KSh ${Math.round(n).toLocaleString()}`;

/** Aggregate items across a group so the packer sees totals to pull. */
function packTotals(orders: Order[]): Item[] {
  const byKey = new Map<string, Item>();
  for (const o of orders) {
    for (const it of o.items) {
      const key = `${it.productName}|${it.unit}`;
      const cur = byKey.get(key) ?? { productName: it.productName, unit: it.unit, quantity: 0 };
      cur.quantity += it.quantity;
      byKey.set(key, cur);
    }
  }
  return [...byKey.values()].sort((a, b) => a.productName.localeCompare(b.productName));
}

function GroupBlock({ group }: { group: Group }) {
  const totals = packTotals(group.orders);
  return (
    <section className="dispatch-group">
      <h3>
        {group.label} <span className="muted">· {group.orders.length} order(s)</span>
      </h3>
      <div className="pack-summary">
        <strong>Pack:</strong>{" "}
        {totals.map((t, i) => (
          <span key={`${t.productName}-${t.unit}`}>
            {i > 0 ? " · " : ""}
            {t.productName} — {t.quantity} {t.unit}
          </span>
        ))}
      </div>
      <table className="orders">
        <thead>
          <tr>
            <th>Order</th>
            <th>Receiver</th>
            <th>Where</th>
            <th>Items</th>
            <th>Pay</th>
          </tr>
        </thead>
        <tbody>
          {group.orders.map((o) => (
            <tr key={o.number}>
              <td>
                <strong>{o.number}</strong>
                {o.trackingNumber ? <><br /><span className="muted">#{o.trackingNumber}</span></> : null}
              </td>
              <td>
                {o.receiverName ?? "—"}
                <br />
                <span className="muted">{o.receiverPhone ?? ""}</span>
              </td>
              <td>
                {o.zoneName ?? ([o.town, o.county].filter(Boolean).join(", ") || "—")}
                {o.address ? <><br /><span className="muted">{o.address}</span></> : null}
                {o.landmark ? <><br /><span className="muted">↳ {o.landmark}</span></> : null}
              </td>
              <td>
                {o.items.map((it, i) => (
                  <div key={i}>{it.productName} × {it.quantity} {it.unit}</div>
                ))}
              </td>
              <td>
                {o.paymentStatus === "PAID" ? "Paid" : <strong>COD {ksh(o.total)}</strong>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function DispatchClient() {
  const [filter, setFilter] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = filter ? `?status=${encodeURIComponent(filter)}` : "";
    const res = await fetch(`/api/dispatch${qs}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <style>{`
        .pack-summary { font-size: 0.85rem; margin: 4px 0 8px; color: #333; }
        .dispatch-group { margin-bottom: 22px; break-inside: avoid; }
        .dispatch-group h3 { margin: 12px 0 4px; font-size: 1.05rem; }
        @media print {
          .no-print, header.site, nav { display: none !important; }
          .container { max-width: none; }
          table.orders { font-size: 11px; }
          a[href]:after { content: ""; }
        }
      `}</style>

      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "8px 0 16px" }}>
        {FILTERS.map((f) => (
          <button
            key={f.v}
            className="btn btn-outline"
            onClick={() => setFilter(f.v)}
            style={{ borderColor: filter === f.v ? "var(--green)" : undefined }}
          >
            {f.l}
          </button>
        ))}
        <button className="btn btn-wa" onClick={() => window.print()} style={{ marginLeft: "auto" }}>
          🖨️ Print
        </button>
      </div>

      {loading || !data ? (
        <p>Loading…</p>
      ) : data.count === 0 ? (
        <p className="muted">No orders to dispatch for this filter.</p>
      ) : (
        <>
          <div className="run-header" style={{ marginBottom: 12 }}>
            <strong>Farm City — dispatch run</strong>{" "}
            <span className="muted">{new Date().toLocaleString()} · {data.count} order(s)</span>
          </div>

          {data.rider.length > 0 ? (
            <>
              <h2 className="category">🛵 Rider runs (fresh produce)</h2>
              {data.rider.map((g) => <GroupBlock key={g.key} group={g} />)}
            </>
          ) : null}

          {data.courier.length > 0 ? (
            <>
              <h2 className="category">📦 Seedlings &amp; countrywide</h2>
              {data.courier.map((g) => <GroupBlock key={g.key} group={g} />)}
            </>
          ) : null}
        </>
      )}
    </>
  );
}
