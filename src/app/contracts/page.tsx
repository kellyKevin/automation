import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/staff";
import ContractsClient from "./ContractsClient";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return (
    <>
      <h2 className="category">Contracts &amp; standing orders</h2>
      <p className="muted">
        Contract customers (schools, hotels, resellers) and their recurring
        orders. Standing orders generate a normal order automatically on their
        schedule and confirm it to the customer on WhatsApp.
      </p>
      <ContractsClient />
    </>
  );
}
