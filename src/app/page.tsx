import ShopClient, { type ShopProduct } from "./ShopClient";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getProducts(): Promise<ShopProduct[]> {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return products.map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      unit: p.unit,
      price: p.price,
      available: p.available,
      variety: p.variety,
    }));
  } catch {
    // DB not migrated yet — render an empty shop rather than crashing.
    return [];
  }
}

export default async function HomePage() {
  const products = await getProducts();
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "254700000000";
  return (
    <>
      <p style={{ marginTop: 20 }}>
        Browse our catalogue, add what you need, then tap{" "}
        <strong>Order on WhatsApp</strong>. Our bot confirms your items, collects
        delivery details, and keeps you updated until it arrives.
      </p>
      <ShopClient products={products} whatsappNumber={whatsappNumber} />
    </>
  );
}
