import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/staff";
import DispatchClient from "./DispatchClient";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return (
    <>
      <div className="no-print">
        <h2 className="category">Dispatch &amp; rider lists</h2>
        <p className="muted">
          Print run sheets for today&apos;s deliveries. Rider runs are grouped by
          zone; seedlings and countrywide orders are grouped by method and region.
          Each group shows the totals to pack.
        </p>
      </div>
      <DispatchClient />
    </>
  );
}
