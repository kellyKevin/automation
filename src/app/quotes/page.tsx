import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/staff";
import QuotesClient from "./QuotesClient";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return (
    <>
      <h2 className="category">Bulk &amp; institutional quotes</h2>
      <p className="muted">
        Requests from the website quote form and the bot&apos;s
        &ldquo;Bulk / institution&rdquo; option. Assign one to yourself, record
        the amount you quoted, then move it through to won or lost.
      </p>
      <QuotesClient staffName={staff.name} />
    </>
  );
}
