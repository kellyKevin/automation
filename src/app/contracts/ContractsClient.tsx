"use client";

import { useEffect, useState } from "react";

interface SOItem {
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}
interface StandingOrder {
  id: string;
  label: string | null;
  frequency: string;
  active: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  method: string;
  items: SOItem[];
}
interface Contract {
  id: string;
  organisation: string | null;
  contactPerson: string | null;
  billingEmail: string | null;
  paymentTerms: string | null;
  active: boolean;
  customer: { name: string | null; phone: string };
  standingOrders: StandingOrder[];
}

const FREQUENCIES = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"];
const METHODS = ["LOCAL_RIDER", "COURIER", "BUS", "PICKUP"];
const ksh = (n: number) => `KSh ${Math.round(n).toLocaleString()}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

type ItemDraft = { productName: string; quantity: string; unit: string; unitPrice: string };
const blankItem = (): ItemDraft => ({ productName: "", quantity: "", unit: "kg", unitPrice: "" });

export default function ContractsClient() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // New-contract form.
  const [showNew, setShowNew] = useState(false);
  const [nc, setNc] = useState({ phone: "", organisation: "", contactPerson: "", billingEmail: "", paymentTerms: "" });

  // Add-standing-order form (per contract).
  const [soFor, setSoFor] = useState<string | null>(null);
  const [so, setSo] = useState({ label: "", frequency: "WEEKLY", method: "LOCAL_RIDER", county: "", town: "", address: "", receiverName: "", receiverPhone: "", deliveryFee: "0", startAt: "" });
  const [items, setItems] = useState<ItemDraft[]>([blankItem()]);

  async function load() {
    const res = await fetch("/api/contracts");
    if (res.ok) setContracts((await res.json()).contracts ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function createContract(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nc),
    });
    if (!res.ok) {
      setMsg((await res.json().catch(() => ({}))).error ?? "Could not create contract");
      return;
    }
    setNc({ phone: "", organisation: "", contactPerson: "", billingEmail: "", paymentTerms: "" });
    setShowNew(false);
    load();
  }

  async function createStandingOrder(e: React.FormEvent, contractId: string) {
    e.preventDefault();
    setMsg(null);
    const payload = {
      contractId,
      label: so.label,
      frequency: so.frequency,
      method: so.method,
      county: so.county,
      town: so.town,
      address: so.address,
      receiverName: so.receiverName,
      receiverPhone: so.receiverPhone,
      deliveryFee: Number(so.deliveryFee) || 0,
      startAt: so.startAt || undefined,
      items: items
        .filter((it) => it.productName && it.quantity)
        .map((it) => ({
          productName: it.productName,
          quantity: Number(it.quantity),
          unit: it.unit,
          unitPrice: Number(it.unitPrice) || 0,
        })),
    };
    const res = await fetch("/api/standing-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setMsg((await res.json().catch(() => ({}))).error ?? "Could not create standing order");
      return;
    }
    setSoFor(null);
    setSo({ label: "", frequency: "WEEKLY", method: "LOCAL_RIDER", county: "", town: "", address: "", receiverName: "", receiverPhone: "", deliveryFee: "0", startAt: "" });
    setItems([blankItem()]);
    load();
  }

  async function toggleSo(id: string, active: boolean) {
    await fetch(`/api/standing-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    load();
  }

  async function deleteSo(id: string) {
    if (!confirm("Delete this standing order?")) return;
    await fetch(`/api/standing-orders/${id}`, { method: "DELETE" });
    load();
  }

  async function generateDue() {
    setMsg(null);
    const res = await fetch("/api/jobs/standing-orders", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Generated ${data.generated ?? 0} order(s).` : data.error ?? "Failed");
    load();
  }

  if (loading) return <p>Loading…</p>;

  return (
    <>
      <div style={{ display: "flex", gap: 8, margin: "8px 0 16px", flexWrap: "wrap" }}>
        <button className="btn btn-outline" onClick={() => setShowNew((v) => !v)}>
          {showNew ? "Close" : "+ New contract"}
        </button>
        <button className="btn btn-wa" onClick={generateDue}>Generate due orders now</button>
        {msg ? <span className="muted" style={{ alignSelf: "center" }}>{msg}</span> : null}
      </div>

      {showNew ? (
        <form onSubmit={createContract} className="card" style={{ display: "grid", gap: 8, marginBottom: 16, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <label>Phone*<input value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} style={{ width: "100%" }} /></label>
          <label>Organisation<input value={nc.organisation} onChange={(e) => setNc({ ...nc, organisation: e.target.value })} style={{ width: "100%" }} /></label>
          <label>Contact person<input value={nc.contactPerson} onChange={(e) => setNc({ ...nc, contactPerson: e.target.value })} style={{ width: "100%" }} /></label>
          <label>Billing email<input value={nc.billingEmail} onChange={(e) => setNc({ ...nc, billingEmail: e.target.value })} style={{ width: "100%" }} /></label>
          <label>Payment terms<input placeholder="NET_30" value={nc.paymentTerms} onChange={(e) => setNc({ ...nc, paymentTerms: e.target.value })} style={{ width: "100%" }} /></label>
          <div style={{ gridColumn: "1 / -1" }}><button className="btn btn-wa" type="submit">Create contract</button></div>
        </form>
      ) : null}

      {contracts.length === 0 ? (
        <p className="muted">No contract customers yet.</p>
      ) : (
        contracts.map((c) => (
          <div key={c.id} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong>{c.organisation ?? c.customer.name ?? "—"}</strong>
                <br />
                <span className="muted">{c.contactPerson ? `${c.contactPerson} · ` : ""}{c.customer.phone}{c.paymentTerms ? ` · ${c.paymentTerms}` : ""}</span>
              </div>
              <button className="btn btn-outline" onClick={() => setSoFor(soFor === c.id ? null : c.id)}>
                {soFor === c.id ? "Close" : "+ Standing order"}
              </button>
            </div>

            {c.standingOrders.length > 0 ? (
              <table className="orders" style={{ marginTop: 10 }}>
                <thead>
                  <tr><th>Schedule</th><th>Items</th><th>Next run</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {c.standingOrders.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.label ?? s.frequency}</strong>
                        <br /><span className="muted">{s.frequency.toLowerCase()}</span>
                      </td>
                      <td>
                        {s.items.map((it, i) => (
                          <div key={i}>{it.productName} × {it.quantity} {it.unit} @ {ksh(it.unitPrice)}</div>
                        ))}
                      </td>
                      <td className="muted">{day(s.nextRunAt)}</td>
                      <td>{s.active ? "Active" : "Paused"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn btn-outline" onClick={() => toggleSo(s.id, !s.active)}>
                          {s.active ? "Pause" : "Resume"}
                        </button>{" "}
                        <button className="btn btn-outline" onClick={() => deleteSo(s.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted" style={{ marginTop: 8 }}>No standing orders yet.</p>
            )}

            {soFor === c.id ? (
              <form onSubmit={(e) => createStandingOrder(e, c.id)} style={{ marginTop: 12, display: "grid", gap: 8, background: "#f7f9f5", padding: 12, borderRadius: 8 }}>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                  <label>Label<input value={so.label} onChange={(e) => setSo({ ...so, label: e.target.value })} style={{ width: "100%" }} /></label>
                  <label>Frequency
                    <select value={so.frequency} onChange={(e) => setSo({ ...so, frequency: e.target.value })} style={{ width: "100%" }}>
                      {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>
                  <label>First run<input type="date" value={so.startAt} onChange={(e) => setSo({ ...so, startAt: e.target.value })} style={{ width: "100%" }} /></label>
                  <label>Method
                    <select value={so.method} onChange={(e) => setSo({ ...so, method: e.target.value })} style={{ width: "100%" }}>
                      {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <label>Town<input value={so.town} onChange={(e) => setSo({ ...so, town: e.target.value })} style={{ width: "100%" }} /></label>
                  <label>County<input value={so.county} onChange={(e) => setSo({ ...so, county: e.target.value })} style={{ width: "100%" }} /></label>
                  <label>Address<input value={so.address} onChange={(e) => setSo({ ...so, address: e.target.value })} style={{ width: "100%" }} /></label>
                  <label>Receiver<input value={so.receiverName} onChange={(e) => setSo({ ...so, receiverName: e.target.value })} style={{ width: "100%" }} /></label>
                  <label>Receiver phone<input value={so.receiverPhone} onChange={(e) => setSo({ ...so, receiverPhone: e.target.value })} style={{ width: "100%" }} /></label>
                  <label>Delivery fee<input type="number" min={0} value={so.deliveryFee} onChange={(e) => setSo({ ...so, deliveryFee: e.target.value })} style={{ width: "100%" }} /></label>
                </div>

                <strong style={{ fontSize: "0.9rem" }}>Items</strong>
                {items.map((it, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <input placeholder="Product" value={it.productName} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, productName: e.target.value } : x))} style={{ flex: "2 1 140px" }} />
                    <input placeholder="Qty" type="number" min={0} value={it.quantity} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} style={{ width: 70 }} />
                    <input placeholder="Unit" value={it.unit} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} style={{ width: 80 }} />
                    <input placeholder="Price" type="number" min={0} value={it.unitPrice} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unitPrice: e.target.value } : x))} style={{ width: 90 }} />
                    {items.length > 1 ? <button type="button" className="btn btn-outline" onClick={() => setItems(items.filter((_, i) => i !== idx))}>✕</button> : null}
                  </div>
                ))}
                <div>
                  <button type="button" className="btn btn-outline" onClick={() => setItems([...items, blankItem()])}>+ Add item</button>
                </div>
                <div><button type="submit" className="btn btn-wa">Save standing order</button></div>
              </form>
            ) : null}
          </div>
        ))
      )}
    </>
  );
}
