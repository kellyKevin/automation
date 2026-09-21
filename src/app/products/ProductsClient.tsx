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

  useEffect(() => {
    (async () => {
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
    })();
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

  if (loading) return <p>Loading products…</p>;

  const visible = products.filter(
    (p) =>
      !filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.category.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <>
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
