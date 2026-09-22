import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/staff";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return (
    <>
      <h2 className="category">Reports</h2>
      <p className="muted">
        Sales, best sellers and outstanding payments. Pick a period to see how
        the business is doing.
      </p>
      <ReportsClient />
    </>
  );
}
