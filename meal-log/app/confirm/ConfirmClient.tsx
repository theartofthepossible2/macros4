"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";
import { createClient } from "@/lib/supabase-browser";
import type { ParsedMeal, DisplayMode } from "@/lib/types";

type Phase = "loading" | "parsing" | "review" | "saving" | "done" | "error";

const CONFIDENCE_DOT: Record<string, string> = {
  high: "var(--ok)",
  medium: "var(--warn)",
  low: "var(--err)",
};

export default function ConfirmClient({ displayMode }: { displayMode: DisplayMode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [description, setDescription] = useState("");
  const [parsed, setParsed] = useState<ParsedMeal | null>(null);
  const startedRef = useRef(false);

  // Pull image from sessionStorage on mount
  useEffect(() => {
    const url = sessionStorage.getItem("pending_meal_image");
    if (!url) {
      router.replace("/scan");
      return;
    }
    setImageUrl(url);
    setPhase("review");
  }, [router]);

  async function onAnalyze() {
    if (!imageUrl || startedRef.current) return;
    startedRef.current = true;
    setPhase("parsing");
    setError("");
    try {
      const res = await fetch("/api/parse-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageUrl, description }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Server error (${res.status})`);
      }
      const data: ParsedMeal = await res.json();
      setParsed(data);
      setPhase("review");
    } catch (e: any) {
      setError(e?.message || "Parse failed");
      setPhase("error");
      startedRef.current = false;
    }
  }

  async function onLog() {
    if (!parsed) return;
    setPhase("saving");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired");
      setPhase("error");
      return;
    }
    const { error: insertError } = await supabase.from("meals").insert({
      user_id: user.id,
      description,
      items: parsed.items,
      calories: parsed.totals.calories,
      protein_g: parsed.totals.protein_g,
      carbs_g: parsed.totals.carbs_g,
      fat_g: parsed.totals.fat_g,
      fiber_g: parsed.totals.fiber_g,
      flags: parsed.flags,
      notes: parsed.notes,
      source: "photo",
    });
    if (insertError) {
      setError(insertError.message);
      setPhase("error");
      return;
    }
    sessionStorage.removeItem("pending_meal_image");
    setPhase("done");
    setTimeout(() => router.push("/scan"), 800);
  }

  function updateItemGrams(idx: number, grams: number) {
    if (!parsed) return;
    const next = { ...parsed, items: [...parsed.items] };
    next.items[idx] = { ...next.items[idx], estimated_grams: grams };
    setParsed(next);
  }

  function updateTotal(field: keyof ParsedMeal["totals"], value: number) {
    if (!parsed) return;
    setParsed({ ...parsed, totals: { ...parsed.totals, [field]: value } });
  }

  return (
    <main className="app-frame">
      <header className="app-header">
        <button onClick={() => router.push("/scan")} aria-label="back" style={{ background: "transparent", border: "none", color: "var(--ink-2)", padding: 0, cursor: "pointer", fontSize: 18 }}>←</button>
        <span className="title">Confirm</span>
        <span style={{ width: 18 }} />
      </header>

      <div className="app-content" style={{ padding: "16px 20px 20px" }}>
        {imageUrl && (
          <div style={{ width: "100%", aspectRatio: "4 / 3", background: "#1f1f1d", borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="captured meal" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}

        <label className="label-caps" style={{ display: "block", marginBottom: 6 }}>What's in this meal?</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. grilled chicken, sweet potato, broccoli"
          disabled={phase === "parsing" || phase === "saving"}
          style={{ marginBottom: 18 }}
        />

        {phase === "review" && !parsed && (
          <button className="primary" onClick={onAnalyze} disabled={!description.trim()}>Analyze meal</button>
        )}

        {phase === "parsing" && (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--ink-2)", fontSize: 13 }}>Analyzing photo…</div>
        )}

        {phase === "error" && (
          <div style={{ padding: 12, border: "0.5px solid var(--err)", borderRadius: 8, color: "var(--err)", fontSize: 12, marginBottom: 12 }}>
            {error}
            <button className="ghost" onClick={() => { setPhase("review"); setError(""); }} style={{ marginTop: 8 }}>Retry</button>
          </div>
        )}

        {parsed && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "0.5px solid var(--line)", paddingTop: 14, marginBottom: 4 }}>
              <span className="label-caps">Estimate</span>
              <span style={{ fontSize: 10, color: "var(--ink-3)" }}>tap to edit</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", margin: "10px 0 18px", fontSize: 13 }}>
              {parsed.items.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < parsed.items.length - 1 ? "0.5px solid var(--line)" : "none" }}>
                  <span>{item.name}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      value={item.estimated_grams}
                      onChange={(e) => updateItemGrams(i, parseInt(e.target.value) || 0)}
                      style={{ width: 64, height: 28, fontFamily: "var(--mono)", fontSize: 12, textAlign: "right", padding: "0 8px" }}
                    />
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>g</span>
                    <span title={`${item.confidence} confidence`} style={{ width: 5, height: 5, borderRadius: "50%", background: CONFIDENCE_DOT[item.confidence] }} />
                  </span>
                </div>
              ))}
            </div>

            <MacroPanel totals={parsed.totals} mode={displayMode} onChange={updateTotal} />

            {parsed.flags.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--warn)", marginBottom: 12 }}>
                Flags: {parsed.flags.join(", ")}
              </div>
            )}
            {parsed.notes && (
              <div style={{ fontSize: 11, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.5 }}>{parsed.notes}</div>
            )}

            <button className="primary" onClick={onLog} disabled={phase === "saving"} style={{ marginBottom: 8 }}>
              {phase === "saving" ? "Logging…" : phase === "done" ? "Logged ✓" : "Log meal"}
            </button>
            <button className="ghost" onClick={() => router.push("/scan")} disabled={phase === "saving"}>Retake photo</button>
          </>
        )}
      </div>

      <TabBar />
    </main>
  );
}

function MacroPanel({
  totals,
  mode,
  onChange,
}: {
  totals: ParsedMeal["totals"];
  mode: DisplayMode;
  onChange: (field: keyof ParsedMeal["totals"], value: number) => void;
}) {
  const fields: Array<{ key: keyof ParsedMeal["totals"]; label: string; suffix?: string }> = [];
  fields.push({ key: "calories", label: "Calories" });
  if (mode !== "calories_only") fields.push({ key: "protein_g", label: "Protein", suffix: "g" });
  if (mode === "full_macros" || mode === "macros_fiber") {
    fields.push({ key: "carbs_g", label: "Carbs", suffix: "g" });
    fields.push({ key: "fat_g", label: "Fat", suffix: "g" });
  }
  if (mode === "macros_fiber") fields.push({ key: "fiber_g", label: "Fiber", suffix: "g" });

  return (
    <div style={{ background: "#f4f4ef", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: fields.length > 2 ? "1fr 1fr" : `repeat(${fields.length}, 1fr)`, gap: "12px 20px" }}>
        {fields.map((f) => (
          <div key={f.key}>
            <div className="label-caps" style={{ fontSize: 10, marginBottom: 2 }}>{f.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <input
                type="number"
                value={totals[f.key]}
                onChange={(e) => onChange(f.key, parseInt(e.target.value) || 0)}
                style={{ width: "100%", height: 32, fontFamily: "var(--mono)", fontSize: 18, fontWeight: 500, padding: "0 4px", border: "none", background: "transparent" }}
              />
              {f.suffix && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{f.suffix}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
