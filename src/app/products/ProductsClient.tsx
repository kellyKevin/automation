"use client";

import { Fragment, useEffect, useState } from "react";

interface Product {
  slug: string;
  name: string;
  category: string;
  subCategory: string | null;
  unit: string;
  price: number;
  stock: number;
  available: boolean;
  variety: string | null;
  imageUrl: string | null;
  description: string | null;
}

const CATEGORIES = [
  { v: "produce", l: "Fresh produce" },
  { v: "seedling", l: "Seedling" },
];
const SUBCATEGORIES = [
  "Vegetables",
  "Leafy Greens",
  "Fruit Vegetables",
  "Fruits",
  "Citrus Fruits",
  "Tubers",
  "Fruit Seedlings",
  "Tree & Nut Seedlings",
  "Coffee & Cash Crops",
  "Herbs & Aromatics",
  "Berry Plants",
  "Vegetable Seedlings",
];
const UNITS = ["kg", "bunch", "tray", "piece", "punnet (250g)", "head", "seedling", "bundle", "net bag", "crate"];

// Resize an image file to a small JPEG data URL so it stores compactly.
async function fileToDataUrl(file: File, max = 600, quality = 0.75): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = document.createElement("img");
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

type EditForm = {
  name: string;
  category: string;
  subCategory: string;
  unit: string;
  price: string;
  stock: string;
  available: boolean;
  variety: string;
  imageUrl: string;
  description: string;
};

const blankNew: EditForm = {
  name: "",
  category: "produce",
  subCategory: "Vegetables",
  unit: "kg",
  price: "",
  stock: "0",
  available: true,
  variety: "",
  imageUrl: "",
  description: "",
};

export default function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState<EditForm>(blankNew);

  async function load() {
    const res = await fetch("/api/products");
    if (res.ok) setProducts((await res.json()).products ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function openEdit(p: Product) {
    setEditing(p.slug);
    setError(null);
    setForm({
      name: p.name,
      category: p.category,
      subCategory: p.subCategory ?? "",
      unit: p.unit,
      price: String(p.price),
      stock: String(p.stock),
      available: p.available,
      variety: p.variety ?? "",
      imageUrl: p.imageUrl ?? "",
      description: p.description ?? "",
    });
  }

  async function pickImage(file: File | undefined, target: "edit" | "new") {
    if (!file) return;
    setBusy(true);
    try {
      const url = await fileToDataUrl(file);
      if (target === "edit") setForm((f) => (f ? { ...f, imageUrl: url } : f));
      else setNewForm((f) => ({ ...f, imageUrl: url }));
    } finally {
      setBusy(false);
    }
  }

  function payload(f: EditForm) {
    return {
      name: f.name,
      category: f.category,
      subCategory: f.subCategory || null,
      unit: f.unit,
      price: Number(f.price),
      stock: Number(f.stock),
      available: f.available,
      variety: f.variety || null,
      imageUrl: f.imageUrl || null,
      description: f.description || null,
    };
  }

  async function saveEdit(slug: string) {
    if (!form) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/products/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(form)),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Save failed");
      return;
    }
    setEditing(null);
    setForm(null);
    load();
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(newForm)),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not add product");
      return;
    }
    setNewForm(blankNew);
    setShowNew(false);
    load();
  }

  if (loading) return <p>Loading products…</p>;

  const visible = products.filter(
    (p) =>
      !filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.category.toLowerCase().includes(filter.toLowerCase()) ||
      (p.subCategory ?? "").toLowerCase().includes(filter.toLowerCase()),
  );

  const fieldGrid = (f: EditForm, set: (patch: Partial<EditForm>) => void, target: "edit" | "new") => (
    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
      <label>Name<input value={f.name} onChange={(e) => set({ name: e.target.value })} style={{ width: "100%" }} /></label>
      <label>Category
        <select value={f.category} onChange={(e) => set({ category: e.target.value })} style={{ width: "100%" }}>
          {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
      </label>
      <label>Sub-category
        <select value={f.subCategory} onChange={(e) => set({ subCategory: e.target.value })} style={{ width: "100%" }}>
          <option value="">—</option>
          {SUBCATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label>Unit
        <select value={f.unit} onChange={(e) => set({ unit: e.target.value })} style={{ width: "100%" }}>
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          {!UNITS.includes(f.unit) && f.unit ? <option value={f.unit}>{f.unit}</option> : null}
        </select>
      </label>
      <label>Price (KSh)<input type="number" min={0} value={f.price} onChange={(e) => set({ price: e.target.value })} style={{ width: "100%" }} /></label>
      <label>Stock<input type="number" min={0} value={f.stock} onChange={(e) => set({ stock: e.target.value })} style={{ width: "100%" }} /></label>
      <label>Variety<input value={f.variety} onChange={(e) => set({ variety: e.target.value })} style={{ width: "100%" }} /></label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 18 }}>
        <input type="checkbox" checked={f.available} onChange={(e) => set({ available: e.target.checked })} /> Available
      </label>
      <label style={{ gridColumn: "1 / -1" }}>Description
        <input value={f.description} onChange={(e) => set({ description: e.target.value })} style={{ width: "100%" }} />
      </label>
      <label style={{ gridColumn: "1 / -1" }}>Image (upload from your computer)
        <input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0], target)} />
      </label>
      {f.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={f.imageUrl} alt="preview" style={{ height: 64, borderRadius: 8, gridColumn: "1 / -1", width: "fit-content" }} />
      ) : null}
    </div>
  );

  return (
    <>
      <div style={{ margin: "8px 0" }}>
        <button className="btn btn-outline" onClick={() => setShowNew((v) => !v)}>
          {showNew ? "Close" : "+ New product"}
        </button>
      </div>

      {showNew ? (
        <form onSubmit={createProduct} className="card" style={{ marginBottom: 16, display: "grid", gap: 10 }}>
          {fieldGrid(newForm, (patch) => setNewForm((f) => ({ ...f, ...patch })), "new")}
          {error ? <div style={{ color: "#b02a37", fontSize: "0.85rem" }}>{error}</div> : null}
          <div>
            <button type="submit" className="btn btn-wa" disabled={busy}>{busy ? "Saving…" : "Add product"}</button>
          </div>
        </form>
      ) : null}

      <input
        placeholder="Filter by name, category or sub-category…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ margin: "8px 0 12px", width: 360, maxWidth: "100%" }}
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
          {visible.map((p) => (
            <Fragment key={p.slug}>
              <tr>
                <td>
                  <strong>{p.name}</strong>
                  <br />
                  <span className="muted">{p.subCategory ?? p.unit}</span>
                </td>
                <td>{p.category}</td>
                <td>{p.price}</td>
                <td>{p.stock}</td>
                <td>{p.available ? "✓" : "—"}</td>
                <td>
                  <button className="btn btn-outline" onClick={() => (editing === p.slug ? setEditing(null) : openEdit(p))}>
                    {editing === p.slug ? "Close" : "Edit"}
                  </button>
                </td>
              </tr>
              {editing === p.slug && form ? (
                <tr>
                  <td colSpan={6} style={{ background: "#f7f9f5" }}>
                    {fieldGrid(form, (patch) => setForm((f) => (f ? { ...f, ...patch } : f)), "edit")}
                    {error ? <div style={{ color: "#b02a37", fontSize: "0.85rem", marginTop: 6 }}>{error}</div> : null}
                    <div style={{ marginTop: 10 }}>
                      <button className="btn btn-wa" onClick={() => saveEdit(p.slug)} disabled={busy}>
                        {busy ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </>
  );
}
