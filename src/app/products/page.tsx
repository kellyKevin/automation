import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/staff";
import ProductsClient from "./ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return (
    <>
      <h2 className="category">Products</h2>
      <p className="muted">
        Update prices, stock and availability. Changes take effect immediately —
        the bot reads these values when pricing new orders.
      </p>
      <ProductsClient />
    </>
  );
}
