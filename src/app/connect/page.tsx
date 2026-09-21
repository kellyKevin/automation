import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/staff";
import ConnectClient from "./ConnectClient";

export const dynamic = "force-dynamic";

export default async function ConnectPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return (
    <>
      <h2 className="category">WhatsApp connection</h2>
      <p className="muted">
        Set up the WhatsApp Cloud API in Meta, then use this page to confirm the
        credentials are wired and send a test message. Full walkthrough is in{" "}
        <code>docs/whatsapp-setup.md</code>.
      </p>
      <ConnectClient />
    </>
  );
}
