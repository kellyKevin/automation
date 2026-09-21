"use client";

import { useEffect, useState } from "react";

interface Product {
  slug: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  available: boolean;
}

interface RowState {
  price: string;
  stock: string;
  available: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

export default function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  // New-product form.
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "produce",
    subCategory: "",
    unit: "kg",
    price: "",
    stock: "0",
    variety: "",
    imageUrl: "",
  });

  async function load() {
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      const list: Product[] = data.products ?? [];
      setProducts(list);
      const initial: Record<string, RowState> = {};
      for (const p of list) {
        initial[p.slug] = {
          price: String(p.price),
          stock: String(p.stock),
          available: p.available,
          saving: false,
          saved: false,
          error: null,
        };
      }
      setRows(initial);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function setRow(slug: string, patch: Partial<RowState>) {
    setRows((r) => ({ ...r, [slug]: { ...r[slug], ...patch, saved: false } }));
  }

  async function save(slug: string) {
    const row = rows[slug];
    setRow(slug, { saving: true, error: null });
    const res = await fetch(`/api/products/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price: Number(row.price),
        stock: Number(row.stock),
        available: row.available,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRows((r) => ({ ...r, [slug]: { ...r[slug], saving: false, error: data.error ?? "Save failed" } }));
      return;
    }
    setRows((r) => ({ ...r, [slug]: { ...r[slug], saving: false, saved: true, error: null } }));
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        category: form.category,
        subCategory: form.subCategory || undefined,
        unit: form.unit,
        price: Number(form.price),
        stock: Number(form.stock),
        variety: form.variety || undefined,
        imageUrl: form.imageUrl || undefined,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCreateError(data.error ?? "Could not create product");
      return;
    }
    setForm({ name: "", category: "produce", subCategory: "", unit: "kg", price: "", stock: "0", variety: "", imageUrl: "" });
    setShowNew(false);
    load();
  }

  if (loading) return <p>Loading products…</p>;

  const visible = products.filter(
    (p) =>
      !filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.category.toLowerCase().includes(filter.toLowerCase()),
  );

  const setF = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <>
      <div style={{ margin: "8px 0" }}>
        <button className="btn btn-outline" onClick={() => setShowNew((v) => !v)}>
          {showNew ? "Close" : "+ New product"}
        </button>
      </div>

      {showNew ? (
        <form onSubmit={createProduct} className="card" style={{ marginBottom: 16, display: "grid", gap: 8, maxWidth: 640 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input required placeholder="Name *" value={form.name} onChange={(e) => setF({ name: e.target.value })} style={{ flex: "1 1 200px" }} />
            <select value={form.category} onChange={(e) => setF({ category: e.target.value })}>
              <option value="produce">Produce</option>
              <option value="seedling">Seedling</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input placeholder="Sub-category (e.g. Vegetables)" value={form.subCategory} onChange={(e) => setF({ subCategory: e.target.value })} style={{ flex: "1 1 180px" }} />
            <input required placeholder="Unit (kg, seedling…)" value={form.unit} onChange={(e) => setF({ unit: e.target.value })} style={{ width: 140 }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input required type="number" min={0} placeholder="Price *" value={form.price} onChange={(e) => setF({ price: e.target.value })} style={{ width: 120 }} />
            <input type="number" min={0} placeholder="Stock" value={form.stock} onChange={(e) => setF({ stock: e.target.value })} style={{ width: 120 }} />
            <input placeholder="Variety (optional)" value={form.variety} onChange={(e) => setF({ variety: e.target.value })} style={{ flex: "1 1 160px" }} />
          </div>
          <input placeholder="Image URL (optional)" value={form.imageUrl} onChange={(e) => setF({ imageUrl: e.target.value })} />
          {createError ? <div style={{ color: "#b02a37", fontSize: "0.85rem" }}>{createError}</div> : null}
          <div>
            <button type="submit" className="btn btn-wa" disabled={creating}>
              {creating ? "Adding…" : "Add product"}
            </button>
          </div>
        </form>
      ) : null}

      <input
        placeholder="Filter by name or category…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ margin: "8px 0 12px", width: 320, maxWidth: "100%" }}
      />
      <table className="orders">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Price (KSh)</th>
            <th>Stock</th>
            <th>Available</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => {
            const row = rows[p.slug];
            if (!row) return null;
            return (
              <tr key={p.slug}>
                <td>
                  <strong>{p.name}</strong>
                  <br />
                  <span className="muted">{p.unit}</span>
                </td>
                <td>{p.category}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={row.price}
                    onChange={(e) => setRow(p.slug, { price: e.target.value })}
                    style={{ width: 90 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={row.stock}
                    onChange={(e) => setRow(p.slug, { stock: e.target.value })}
                    style={{ width: 90 }}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.available}
                    onChange={(e) => setRow(p.slug, { available: e.target.checked })}
                  />
                </td>
                <td>
                  <button className="btn btn-outline" onClick={() => save(p.slug)} disabled={row.saving}>
                    {row.saving ? "Saving…" : row.saved ? "Saved ✓" : "Save"}
                  </button>
                  {row.error ? <div style={{ color: "#b02a37", fontSize: "0.78rem" }}>{row.error}</div> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
