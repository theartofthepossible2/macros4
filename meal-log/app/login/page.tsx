"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setError(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="app-frame" style={{ justifyContent: "center", padding: "0 24px" }}>
      <div style={{ marginTop: "auto", marginBottom: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div className="label-caps" style={{ marginBottom: 6 }}>Sign in</div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Meal Log</h1>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "sending" || status === "sent"}
          />
          <button className="primary" disabled={status === "sending" || status === "sent"}>
            {status === "sent" ? "Check your email" : status === "sending" ? "Sending…" : "Send magic link"}
          </button>
        </form>

        {status === "sent" && (
          <p style={{ fontSize: 12, color: "var(--ink-2)", margin: 0 }}>
            We sent a sign-in link to {email}. Open it on this device.
          </p>
        )}
        {status === "error" && (
          <p style={{ fontSize: 12, color: "var(--err)", margin: 0 }}>{error}</p>
        )}
      </div>
    </main>
  );
}
