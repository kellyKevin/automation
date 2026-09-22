import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/staff";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return (
    <>
      <h2 className="category">Customers</h2>
      <p className="muted">
        Everyone who has messaged or ordered. Search by name or phone, and open a
        customer to see their order history and quotes.
      </p>
      <CustomersClient />
    </>
  );
}
