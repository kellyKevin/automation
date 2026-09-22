"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ width: "100%", maxWidth: 380, padding: 28, boxShadow: "var(--shadow-lg)" }}>
      <div style={{ fontSize: "1.8rem" }}>🌱</div>
      <h2 className="category" style={{ marginTop: 6 }}>Farm City sign in</h2>
      <p className="muted">Manage orders, chats, dispatch and reports.</p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          <div className="muted">Phone</div>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="254711911690"
            style={{ width: "100%" }}
            required
          />
        </label>
        <label>
          <div className="muted">Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%" }}
            required
          />
        </label>
        {error ? <div style={{ color: "#b02a37", fontSize: "0.85rem" }}>{error}</div> : null}
        <button type="submit" className="btn btn-wa" disabled={busy} style={{ marginTop: 4 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
