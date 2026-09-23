"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

const NAV: { href: string; label: string; ic: string }[] = [
  { href: "/admin", label: "Orders", ic: "🧾" },
  { href: "/inbox", label: "Inbox", ic: "💬" },
  { href: "/customers", label: "Customers", ic: "👥" },
  { href: "/products", label: "Products", ic: "🥬" },
  { href: "/dispatch", label: "Dispatch", ic: "🛵" },
  { href: "/quotes", label: "Quotes", ic: "📨" },
  { href: "/contracts", label: "Contracts", ic: "🔁" },
  { href: "/invoices", label: "Invoices", ic: "📑" },
  { href: "/reports", label: "Reports", ic: "📊" },
  { href: "/connect", label: "Connect", ic: "🔌" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "FC";
}

export default function Shell({
  staffName,
  children,
}: {
  staffName: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "";

  // Unauthenticated (login) — no dashboard chrome.
  if (!staffName) {
    return <div className="auth-wrap">{children}</div>;
  }

  const active = NAV.slice().sort((a, b) => b.href.length - a.href.length).find(
    (n) => pathname === n.href || pathname.startsWith(n.href + "/"),
  );
  const title = active?.label ?? "Dashboard";

  return (
    <div className="app">
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="brand-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Farm City" className="brand-logo" />
        </div>
        <div className="brand-sub">Owner dashboard</div>

        <nav className="nav" onClick={() => setOpen(false)}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-link${active?.href === n.href ? " active" : ""}`}
            >
              <span className="ic">{n.ic}</span>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="avatar">{initials(staffName)}</span>
          <span className="who">
            <b>{staffName}</b>
            <span>Signed in</span>
          </span>
          <span style={{ marginLeft: "auto" }}>
            <LogoutButton />
          </span>
        </div>
      </aside>

      <div className={`scrim${open ? " show" : ""}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="hamburger" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
            ☰
          </button>
          <h1>{title}</h1>
          <span className="spacer" />
        </header>
        <main className="content container">{children}</main>
      </div>
    </div>
  );
}
