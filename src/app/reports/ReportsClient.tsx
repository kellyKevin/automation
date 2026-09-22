"use client";

import { useCallback, useEffect, useState } from "react";

interface Totals {
  orders: number;
  revenue: number;
  paidOrders: number;
  paidRevenue: number;
  unpaidOrders: number;
  unpaidValue: number;
}
interface ProductSales {
  productName: string;
  quantity: number;
  revenue: number;
  orderLines: number;
}
interface UnpaidRow {
  number: string;
  total: number;
  status: string;
  createdAt: string;
  customer: string | null;
  phone: string | null;
}
interface Report {
  days: number;
  totals: Totals;
  bestSellers: ProductSales[];
  unpaid: UnpaidRow[];
}

const PERIODS = [
  { v: 7, l: "7 days" },
  { v: 30, l: "30 days" },
  { v: 90, l: "90 days" },
  { v: 365, l: "1 year" },
];

const ksh = (n: number) => `KSh ${Math.round(n).toLocaleString()}`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card" style={{ flex: "1 1 160px" }}>
      <div className="muted" style={{ fontSize: "0.8rem" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{value}</div>
      {hint ? <div className="muted" style={{ fontSize: "0.75rem" }}>{hint}</div> : null}
    </div>
  );
}

export default function ReportsClient() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/reports?days=${days}`);
    if (res.ok) setReport(await res.json());
    setLoading(false);
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div style={{ display: "flex", gap: 8, margin: "8px 0 16px", alignItems: "center" }}>
        <span className="muted">Period:</span>
        {PERIODS.map((p) => (
          <button
            key={p.v}
            className="btn btn-outline"
            onClick={() => setDays(p.v)}
            style={{ borderColor: days === p.v ? "var(--green)" : undefined }}
          >
            {p.l}
          </button>
        ))}
      </div>

      {loading || !report ? (
        <p>Loading…</p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            <Stat label="Orders" value={String(report.totals.orders)} hint={`last ${report.days} days`} />
            <Stat label="Collected" value={ksh(report.totals.paidRevenue)} hint={`${report.totals.paidOrders} paid`} />
            <Stat
              label="Outstanding"
              value={ksh(report.totals.unpaidValue)}
              hint={`${report.totals.unpaidOrders} unpaid`}
            />
            <Stat label="Order value" value={ksh(report.totals.revenue)} hint="excl. cancelled" />
          </div>

          <h3 className="category" style={{ fontSize: "1.05rem" }}>Best sellers</h3>
          {report.bestSellers.length === 0 ? (
            <p className="muted">No sales in this period.</p>
          ) : (
            <table className="orders" style={{ marginBottom: 24 }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty sold</th>
                  <th>Revenue</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {report.bestSellers.map((p) => (
                  <tr key={p.productName}>
                    <td>{p.productName}</td>
                    <td>{p.quantity}</td>
                    <td>{ksh(p.revenue)}</td>
                    <td>{p.orderLines}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="category" style={{ fontSize: "1.05rem" }}>
            Outstanding payments {report.unpaid.length ? `(${report.unpaid.length})` : ""}
          </h3>
          {report.unpaid.length === 0 ? (
            <p className="muted">Nothing outstanding — all caught up. 🎉</p>
          ) : (
            <table className="orders">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {report.unpaid.map((o) => (
                  <tr key={o.number}>
                    <td><strong>{o.number}</strong></td>
                    <td>
                      {o.customer ?? "—"}
                      <br />
                      <span className="muted" style={{ fontSize: "0.8rem" }}>{o.phone}</span>
                    </td>
                    <td>{o.status}</td>
                    <td>{ksh(o.total)}</td>
                    <td className="muted" style={{ fontSize: "0.8rem" }}>
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
