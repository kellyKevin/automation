import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Farm City — Fresh produce & seedlings",
  description:
    "Order fresh produce and seedlings from Farm City on WhatsApp. Juja & Thika delivery, countrywide seedling dispatch.",
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
            <h1>🌱 Farm City</h1>
            <p>Fresh produce &amp; seedlings — order on WhatsApp</p>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
