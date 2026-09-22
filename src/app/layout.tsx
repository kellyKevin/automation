import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getStaff } from "@/lib/auth/staff";
import LogoutButton from "./LogoutButton";

export const metadata: Metadata = {
  title: "Farm City — Owner Dashboard",
  description:
    "Farm City operations dashboard: manage orders, payments, delivery and status updates for the WhatsApp ordering system.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getStaff();
  return (
    <html lang="en">
      <body>
        <header className="site">
          <div className="container">
            <h1>🌱 Farm City — Dashboard</h1>
            <p>Orders, payments &amp; delivery for the WhatsApp ordering system</p>
            {staff ? (
              <nav style={{ display: "flex", gap: 16, marginTop: 8, alignItems: "center" }}>
                <Link className="navlink" href="/admin">Orders</Link>
                <Link className="navlink" href="/inbox">Inbox</Link>
                <Link className="navlink" href="/products">Products</Link>
                <Link className="navlink" href="/dispatch">Dispatch</Link>
                <Link className="navlink" href="/quotes">Quotes</Link>
                <Link className="navlink" href="/reports">Reports</Link>
                <Link className="navlink" href="/connect">Connect</Link>
                <span style={{ marginLeft: "auto", opacity: 0.9 }}>{staff.name}</span>
                <LogoutButton />
              </nav>
            ) : null}
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
