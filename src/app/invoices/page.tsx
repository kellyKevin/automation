import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/staff";
import InvoicesClient from "./InvoicesClient";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return (
    <>
      <div className="no-print">
        <h2 className="category">Invoices</h2>
        <p className="muted">
          Generate an invoice for a contract customer&apos;s orders over a period,
          then mark it sent and paid. Open one to print it.
        </p>
      </div>
      <InvoicesClient />
    </>
  );
}
