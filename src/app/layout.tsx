import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Farm City — Owner Dashboard",
  description:
    "Farm City operations dashboard: manage orders, payments, delivery and status updates for the WhatsApp ordering system.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <div className="container">
            <h1>🌱 Farm City — Dashboard</h1>
            <p>Orders, payments &amp; delivery for the WhatsApp ordering system</p>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
