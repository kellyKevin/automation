import "./globals.css";
import type { Metadata } from "next";
import { getStaff } from "@/lib/auth/staff";
import Shell from "./Shell";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,900&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Shell staffName={staff?.name ?? null}>{children}</Shell>
      </body>
    </html>
  );
}
