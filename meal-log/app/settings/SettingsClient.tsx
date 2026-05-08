"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";
import { createClient } from "@/lib/supabase-browser";
import type { DisplayMode, UnitSystem } from "@/lib/types";

type Props = {
  email: string;
  fullName: string;
  barcode: string;
  displayMode: DisplayMode;
  units: UnitSystem;
};

const DISPLAY_OPTIONS: Array<{ value: DisplayMode; label: string; example: string }> = [
  { value: "calories_only", label: "Calories only", example: "520 cal" },
  { value: "calories_protein", label: "Calories + protein", example: "520 cal · 48 p" },
  { value: "full_macros", label: "Full macros", example: "520 cal · 48 p · 52 c · 10 f" },
  { value: "macros_fiber", label: "Macros + fiber", example: "520 cal · 48 p · 52 c · 10 f · 8 fib" },
];

export default function SettingsClient(props: Props) {
  const router = useRouter();
  const [barcode, setBarcode] = useState(props.barcode);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(props.displayMode);
  const [units, setUnits] = useState<UnitSystem>(props.units);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function saveBarcode() {
    setStatus("saving");
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus("error"); setError("Session expired"); return; }
    const trimmed = barcode.trim();
    const { error: e } = await supabase
      .from("profiles")
      .update({ barcode_number: trimmed || null })
      .eq("id", user.id);
    if (e) { setStatus("error"); setError(e.message); }
    else { setStatus("saved"); setTimeout(() => setStatus("idle"), 1500); }
  }

  async function savePrefs(next: { display_mode?: DisplayMode; units?: UnitSystem }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("preferences").update(next).eq("user_id", user.id);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="app-frame">
      <header className="app-header">
        <span className="title">Settings</span>
      </header>

      <div className="app-content" style={{ padding: 20 }}>
        <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>Membership tag number</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <input
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="0042-7831-9904"
            className="mono"
            style={{ flex: 1, fontFamily: "var(--mono)", letterSpacing: "0.05em" }}
          />
          <button className="primary" onClick={saveBarcode} disabled={status === "saving"} style={{ width: "auto", padding: "0 16px" }}>
            {status === "saving" ? "…" : "Save"}
          </button>
        </div>
        {status === "saved" && (
          <span style={{ fontSize: 11, color: "var(--ok)", display: "flex", alignItems: "center", gap: 4 }}>✓ saved</span>
        )}
        {status === "error" && (
          <span style={{ fontSize: 11, color: "var(--err)" }}>{error}</span>
        )}

        <div className="divider" style={{ margin: "22px 0 14px" }} />
        <span className="label-caps">Display</span>
        <p style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6, marginBottom: 12, lineHeight: 1.5 }}>
          What's shown after each meal log. Your full data is always saved.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DISPLAY_OPTIONS.map((opt) => {
            const active = displayMode === opt.value;
            return (
              <label key={opt.value} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px 14px",
                border: active ? "1.5px solid var(--ink)" : "0.5px solid var(--line)",
                borderRadius: 8, cursor: "pointer",
              }}>
                <input
                  type="radio"
                  name="display"
                  checked={active}
                  onChange={() => { setDisplayMode(opt.value); savePrefs({ display_mode: opt.value }); }}
                  style={{ marginTop: 2 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-2)", fontFamily: "var(--mono)" }}>{opt.example}</div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="divider" style={{ margin: "22px 0 14px" }} />
        <span className="label-caps">Units</span>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {(["metric", "imperial"] as UnitSystem[]).map((u) => (
            <button
              key={u}
              onClick={() => { setUnits(u); savePrefs({ units: u }); }}
              style={{
                flex: 1, padding: 10, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase",
                background: units === u ? "var(--ink)" : "transparent",
                color: units === u ? "white" : "var(--ink-2)",
                border: units === u ? "none" : "0.5px solid var(--line)",
                borderRadius: 8, cursor: "pointer",
                fontWeight: units === u ? 500 : 400,
              }}
            >
              {u === "metric" ? "Grams" : "Ounces"}
            </button>
          ))}
        </div>

        <div className="divider" style={{ margin: "22px 0 14px" }} />
        <span className="label-caps">Account</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 14, marginTop: 12 }}>
          <Row label="Member" value={props.fullName || props.email} />
          <Row label="Email" value={props.email} />
        </div>

        <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 24, lineHeight: 1.5 }}>
          Photos are analyzed and immediately discarded. Only the parsed values are saved.
        </p>

        <button className="ghost" onClick={signOut} style={{ marginTop: 16 }}>Sign out</button>
      </div>

      <TabBar />
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--ink-2)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
