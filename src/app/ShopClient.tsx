"use client";

import { useMemo, useState } from "react";
import { buildOrderLink, generateCartRef, type CartItem } from "@/lib/cart";
import { ksh } from "@/lib/money";

export interface ShopProduct {
  slug: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  available: boolean;
  variety?: string | null;
}

const CATEGORY_TITLES: Record<string, string> = {
  produce: "Fresh produce",
  seedling: "Seedlings",
  grocery: "Groceries",
};

export default function ShopClient({
  products,
  whatsappNumber,
}: {
  products: ShopProduct[];
  whatsappNumber: string;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});

  const cart: CartItem[] = useMemo(
    () =>
      products
        .filter((p) => (qty[p.slug] ?? 0) > 0)
        .map((p) => ({
          slug: p.slug,
          name: p.name,
          quantity: qty[p.slug],
          unit: p.unit,
        })),
    [qty, products],
  );

  const total = useMemo(
    () =>
      products.reduce(
        (sum, p) => sum + (qty[p.slug] ?? 0) * p.price,
        0,
      ),
    [qty, products],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ShopProduct[]>();
    for (const p of products) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return Array.from(map.entries());
  }, [products]);

  const setItemQty = (slug: string, next: number) =>
    setQty((q) => ({ ...q, [slug]: Math.max(0, next) }));

  const orderLink =
    cart.length > 0
      ? buildOrderLink(whatsappNumber, cart, generateCartRef())
      : undefined;

  if (products.length === 0) {
    return (
      <p className="muted">
        No products yet. Seed the catalogue with <code>npm run seed</code>.
      </p>
    );
  }

  return (
    <>
      {grouped.map(([category, items]) => (
        <section key={category}>
          <h2 className="category">
            {CATEGORY_TITLES[category] ?? category}
          </h2>
          <div className="grid">
            {items.map((p) => (
              <div className="card" key={p.slug}>
                <h3>{p.name}</h3>
                {p.variety ? <span className="muted">{p.variety}</span> : null}
                <span className="price">
                  {ksh(p.price)} / {p.unit}
                </span>
                <span className="muted">
                  {p.available ? "In stock" : "Out of stock"}
                </span>
                <div className="qty">
                  <button
                    aria-label={`Remove one ${p.name}`}
                    onClick={() => setItemQty(p.slug, (qty[p.slug] ?? 0) - 1)}
                    disabled={!p.available}
                  >
                    −
                  </button>
                  <span>{qty[p.slug] ?? 0}</span>
                  <button
                    aria-label={`Add one ${p.name}`}
                    onClick={() => setItemQty(p.slug, (qty[p.slug] ?? 0) + 1)}
                    disabled={!p.available}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div style={{ height: 80 }} />

      {cart.length > 0 && orderLink ? (
        <div className="cart-bar">
          <div>
            <strong>{cart.length}</strong> item(s) · {ksh(total)}
          </div>
          <a className="btn btn-wa" href={orderLink} target="_blank" rel="noreferrer">
            💬 Order on WhatsApp
          </a>
        </div>
      ) : null}
    </>
  );
}
