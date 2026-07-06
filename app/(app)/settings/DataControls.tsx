"use client";
import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/UserProvider";
import { todayISO } from "@/lib/format";
import { Card, Button, Divider } from "@/components/ui";

// Union of every entry type's fields; blank cells where a field doesn't apply.
const CSV_HEADER = [
  "type", "date", "name", "protein_g", "carbs_g", "fat_g", "minutes",
  "calories_burned", "sets", "reps", "muscle_group", "weight_lb", "bmr",
] as const;

type Cell = string | number | null | undefined;

function csvField(v: Cell): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(fields: Partial<Record<(typeof CSV_HEADER)[number], Cell>>): Cell[] {
  return CSV_HEADER.map((h) => fields[h]);
}

function toCsv(rows: Cell[][]): string {
  return [[...CSV_HEADER], ...rows].map((r) => r.map(csvField).join(",")).join("\n") + "\n";
}

/**
 * In iOS standalone (home-screen) mode anchor downloads are unreliable, so
 * prefer the share sheet there; everywhere else use a plain download.
 */
async function deliverFile(csv: string, filename: string) {
  const file = new File([csv], filename, { type: "text/csv" });
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return; // user cancelled
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type GroupKey = "macros" | "cardio" | "lifting" | "weight" | "bmr";
const GROUPS: { key: GroupKey; label: string; tables: string[] }[] = [
  { key: "macros", label: "macros", tables: ["macro_entries"] },
  { key: "cardio", label: "cardio", tables: ["cardio_entries"] },
  { key: "lifting", label: "lifting", tables: ["lifting_exercises", "lifting_calorie_entries"] },
  { key: "weight", label: "weight history", tables: ["weight_anchors"] },
  { key: "bmr", label: "bmr history", tables: ["bmr_entries"] },
];

export function DataControls() {
  const { userId } = useUser();
  const supabase = useMemo(() => createClient(), []);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [armed, setArmed] = useState<GroupKey | null>(null);
  const [busy, setBusy] = useState<GroupKey | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const [macros, cardio, liftEx, liftCal, weights, bmrs] = await Promise.all([
        supabase.from("macro_entries").select("date, meal_name, protein_g, carbs_g, fat_g").order("date"),
        supabase.from("cardio_entries").select("date, minutes, calories_burned").order("date"),
        supabase.from("lifting_exercises").select("date, name, muscle_group, sets, reps").order("date"),
        supabase.from("lifting_calorie_entries").select("date, calories_burned").order("date"),
        supabase.from("weight_anchors").select("effective_from, weight_lb").order("effective_from"),
        supabase.from("bmr_entries").select("effective_from, bmr").order("effective_from"),
      ]);
      const failed = [macros, cardio, liftEx, liftCal, weights, bmrs].find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);

      const rows: Cell[][] = [
        ...(macros.data ?? []).map((m) => row({
          type: "macro", date: m.date, name: m.meal_name,
          protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g,
        })),
        ...(cardio.data ?? []).map((c) => row({
          type: "cardio", date: c.date, minutes: c.minutes, calories_burned: c.calories_burned,
        })),
        ...(liftEx.data ?? []).map((l) => row({
          type: "lifting_exercise", date: l.date, name: l.name,
          sets: l.sets, reps: l.reps, muscle_group: l.muscle_group,
        })),
        ...(liftCal.data ?? []).map((l) => row({
          type: "lifting_calories", date: l.date, calories_burned: l.calories_burned,
        })),
        ...(weights.data ?? []).map((w) => row({
          type: "weight", date: w.effective_from, weight_lb: w.weight_lb,
        })),
        ...(bmrs.data ?? []).map((b) => row({
          type: "bmr", date: b.effective_from, bmr: b.bmr,
        })),
      ];
      await deliverFile(toCsv(rows), `macros4-export-${todayISO()}.csv`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  function arm(key: GroupKey) {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArmed(key);
    disarmTimer.current = setTimeout(() => setArmed(null), 4000);
  }

  async function reset(group: (typeof GROUPS)[number]) {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArmed(null);
    setBusy(group.key);
    setResetError(null);
    try {
      for (const table of group.tables) {
        const { error } = await supabase.from(table).delete().eq("user_id", userId);
        if (error) throw new Error(error.message);
      }
      // Reload so BodyInputs and every cached view pick up the emptied tables.
      window.location.reload();
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Reset failed.");
      setBusy(null);
    }
  }

  return (
    <>
      <Card className="p-4 space-y-1">
        <span className="text-sm text-muted">data</span>
        <Divider />
        <div className="flex items-center justify-between py-2">
          <span className="text-base">export all entries</span>
          <Button onClick={exportCsv} disabled={exporting} variant="ghost">
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
        {exportError ? <p className="text-xs text-bad">{exportError}</p> : null}
      </Card>

      <Card className="p-4 space-y-1">
        <span className="text-sm text-muted">reset data</span>
        {GROUPS.map((g) => (
          <div key={g.key}>
            <Divider />
            <div className="flex items-center justify-between py-1">
              <span className="text-base">{g.label}</span>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => (armed === g.key ? reset(g) : arm(g.key))}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:pointer-events-none ${
                  armed === g.key ? "bg-bad text-white" : "bg-transparent text-bad hover:bg-bad/10"
                }`}
              >
                {busy === g.key ? "Resetting…" : armed === g.key ? "Tap to confirm" : "Reset"}
              </button>
            </div>
          </div>
        ))}
        <p className="pt-1 text-xs text-muted">
          Resets are permanent and can&apos;t be undone. Export a CSV first if you want a backup.
        </p>
        {resetError ? <p className="text-xs text-bad">{resetError}</p> : null}
      </Card>
    </>
  );
}
