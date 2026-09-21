import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/staff";
import InboxClient from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return (
    <>
      <h2 className="category">Inbox</h2>
      <p className="muted">
        Chats the bot handed to a human. Reply within the 24-hour window, then
        resolve to hand the conversation back to the bot.
      </p>
      <InboxClient />
    </>
  );
}
