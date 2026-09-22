"use client";

import { useEffect, useState } from "react";

interface Customer { name: string | null; phone: string }
interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  total: number;
  createdAt: string;
  contract: { organisation: string | null; customer: Customer };
  _count: { lines: number };
}
interface Line {
  orderNumber: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
interface InvoiceDetail extends Omit<InvoiceRow, "_count"> {
  subtotal: number;
  notes: string | null;
  lines: Line[];
}
interface ContractOption {
  id: string;
  organisation: string | null;
  customer: Customer;
}

const ksh = (n: number) => `KSh ${Math.round(n).toLocaleString()}`;
const day = (d: string) => new Date(d).toLocaleDateString();
const STATUS_NEXT: Record<string, string[]> = {
  DRAFT: ["SENT", "VOID"],
  SENT: ["PAID", "VOID"],
  PAID: [],
  VOID: [],
};

export default function InvoicesClient() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<InvoiceDetail | null>(null);

  // Generate form.
  const [gen, setGen] = useState({ contractId: "", periodStart: "", periodEnd: "" });

  async function load() {
    const [inv, con] = await Promise.all([fetch("/api/invoices"), fetch("/api/contracts")]);
    if (inv.ok) setInvoices((await inv.json()).invoices ?? []);
    if (con.ok) setContracts((await con.json()).contracts ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gen),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? "Could not generate invoice");
      return;
    }
    setMsg(`Created ${data.number} (${data.orderCount} order(s)).`);
    setGen({ contractId: "", periodStart: "", periodEnd: "" });
    load();
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (open?.id === id) view(id);
    load();
  }

  async function view(id: string) {
    const res = await fetch(`/api/invoices/${id}`);
    if (res.ok) setOpen((await res.json()).invoice);
  }

  if (loading) return <p>Loading…</p>;

  if (open) {
    return (
      <div>
        <style>{`@media print { .no-print, header.site, nav { display: none !important; } }`}</style>
        <div className="no-print" style={{ display: "flex", gap: 8, margin: "8px 0 16px" }}>
          <button className="btn btn-outline" onClick={() => setOpen(null)}>← Back</button>
          <button className="btn btn-wa" onClick={() => window.print()}>🖨️ Print</button>
          {STATUS_NEXT[open.status]?.map((s) => (
            <button key={s} className="btn btn-outline" onClick={() => setStatus(open.id, s)}>Mark {s}</button>
          ))}
        </div>

        <div className="card">
          <h2 className="category" style={{ marginTop: 0 }}>Invoice {open.number}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {open.contract.organisation ?? open.contract.customer.name ?? open.contract.customer.phone}
            {" · "}{open.contract.customer.phone}
          </p>
          <p className="muted" style={{ marginTop: 4 }}>
            Period {day(open.periodStart)} – {day(open.periodEnd)} · Status: <strong>{open.status}</strong>
          </p>

          <table className="orders" style={{ marginTop: 12 }}>
            <thead>
              <tr><th>Order</th><th>Description</th><th>Qty</th><th>Unit</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {open.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.orderNumber ?? "—"}</td>
                  <td>{l.description}</td>
                  <td>{l.quantity}</td>
                  <td>{ksh(l.unitPrice)}</td>
                  <td>{ksh(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={4} style={{ textAlign: "right" }}><strong>Total</strong></td><td><strong>{ksh(open.total)}</strong></td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={generate} className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
        <label>Contract
          <select value={gen.contractId} onChange={(e) => setGen({ ...gen, contractId: e.target.value })} style={{ display: "block", minWidth: 200 }}>
            <option value="">Choose…</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.organisation ?? c.customer.name ?? c.customer.phone}</option>
            ))}
          </select>
        </label>
        <label>From<input type="date" value={gen.periodStart} onChange={(e) => setGen({ ...gen, periodStart: e.target.value })} style={{ display: "block" }} /></label>
        <label>To<input type="date" value={gen.periodEnd} onChange={(e) => setGen({ ...gen, periodEnd: e.target.value })} style={{ display: "block" }} /></label>
        <button type="submit" className="btn btn-wa" disabled={!gen.contractId || !gen.periodStart || !gen.periodEnd}>Generate invoice</button>
        {msg ? <span className="muted">{msg}</span> : null}
      </form>

      {invoices.length === 0 ? (
        <p className="muted">No invoices yet.</p>
      ) : (
        <table className="orders">
          <thead>
            <tr><th>Invoice</th><th>Customer</th><th>Period</th><th>Lines</th><th>Total</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td><strong>{inv.number}</strong></td>
                <td>{inv.contract.organisation ?? inv.contract.customer.name ?? inv.contract.customer.phone}</td>
                <td className="muted" style={{ fontSize: "0.8rem" }}>{day(inv.periodStart)}–{day(inv.periodEnd)}</td>
                <td>{inv._count.lines}</td>
                <td>{ksh(inv.total)}</td>
                <td>{inv.status}</td>
                <td><button className="btn btn-outline" onClick={() => view(inv.id)}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
