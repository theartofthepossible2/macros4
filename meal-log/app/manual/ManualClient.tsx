"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";
import { createClient } from "@/lib/supabase-browser";

export default function ManualClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [servings, setServings] = useState("1");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const mult = parseFloat(servings) || 1;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired");
      setBusy(false);
      return;
    }
    const { error: insertError } = await supabase.from("meals").insert({
      user_id: user.id,
      description: name,
      items: [{ name, estimated_grams: 0, confidence: "high" }],
      calories: Math.round((parseFloat(calories) || 0) * mult),
      protein_g: Math.round((parseFloat(protein) || 0) * mult),
      carbs_g: Math.round((parseFloat(carbs) || 0) * mult),
      fat_g: Math.round((parseFloat(fat) || 0) * mult),
      fiber_g: Math.round((parseFloat(fiber) || 0) * mult),
      flags: [],
      notes: "",
      source: "manual",
    });
    if (insertError) {
      setError(insertError.message);
      setBusy(false);
    } else {
      router.push("/scan");
    }
  }

  return (
    <main className="app-frame">
      <header className="app-header">
        <span className="title">Manual entry</span>
      </header>

      <div className="app-content" style={{ padding: 20 }}>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column" }}>
          <label className="label-caps" style={{ marginBottom: 6 }}>Food name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chobani plain greek yogurt" required style={{ marginBottom: 18 }} />

          <label className="label-caps" style={{ marginBottom: 6 }}>Servings eaten</label>
          <input type="number" value={servings} onChange={(e) => setServings(e.target.value)} step="0.25" min="0" style={{ marginBottom: 18 }} />

          <div style={{ borderTop: "0.5px solid var(--line)", paddingTop: 14, marginBottom: 14 }}>
            <span className="label-caps">Per serving</span>
          </div>

          <Row label="Calories" value={calories} onChange={setCalories} />
          <Row label="Protein" suffix="g" value={protein} onChange={setProtein} />
          <Row label="Carbs" suffix="g" value={carbs} onChange={setCarbs} />
          <Row label="Fat" suffix="g" value={fat} onChange={setFat} />
          <Row label="Fiber" suffix="g" value={fiber} onChange={setFiber} optional />

          {error && <div style={{ color: "var(--err)", fontSize: 12, marginBottom: 12 }}>{error}</div>}

          <button className="primary" type="submit" disabled={busy} style={{ marginTop: 8 }}>
            {busy ? "Logging…" : "Log entry"}
          </button>
        </form>
      </div>

      <TabBar />
    </main>
  );
}

function Row({ label, suffix, value, onChange, optional }: { label: string; suffix?: string; value: string; onChange: (v: string) => void; optional?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <label style={{ fontSize: 14 }}>
        {label}
        {suffix && <span style={{ color: "var(--ink-3)", fontSize: 11, marginLeft: 4 }}>{suffix}</span>}
        {optional && <span style={{ color: "var(--ink-3)", fontSize: 11, marginLeft: 4 }}>optional</span>}
      </label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" min="0" style={{ width: 90, textAlign: "right" }} />
    </div>
  );
}
