"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/UserProvider";
import { macroCalories } from "@/lib/calc";
import { todayISO, prettyDate } from "@/lib/format";
import type { MacroEntry } from "@/lib/types";
import {
  Card, ScreenTitle, Button, Stepper, TextField, DateField, DeleteButton, EmptyState, Divider,
} from "@/components/ui";

export default function MacrosPage() {
  const { userId } = useUser();
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<MacroEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(todayISO());
  const [meal, setMeal] = useState("");
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("macro_entries").select("*")
      .order("date", { ascending: false }).order("created_at", { ascending: false });
    setEntries((data as MacroEntry[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const today = todayISO();
  const todays = entries.filter((e) => e.date === today);
  const totals = todays.reduce(
    (a, e) => ({
      cal: a.cal + macroCalories(e.protein_g, e.carbs_g, e.fat_g),
      p: a.p + e.protein_g, c: a.c + e.carbs_g, f: a.f + e.fat_g,
    }),
    { cal: 0, p: 0, c: 0, f: 0 },
  );

  async function add() {
    if (protein === 0 && carbs === 0 && fat === 0) return;
    setSaving(true);
    await supabase.from("macro_entries").insert({
      user_id: userId, date, meal_name: meal.trim() || null,
      protein_g: protein, carbs_g: carbs, fat_g: fat,
    });
    setMeal(""); setProtein(0); setCarbs(0); setFat(0);
    await load();
    setSaving(false);
  }
  async function remove(id: string) {
    await supabase.from("macro_entries").delete().eq("id", id);
    await load();
  }

  const byDate = useMemo(() => groupByDate(entries), [entries]);

  return (
    <div className="space-y-5">
      <ScreenTitle>macros</ScreenTitle>

      {/* Today's totals */}
      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">total calories</span>
          <span className="text-2xl font-bold">{Math.round(totals.cal)} kcal</span>
        </div>
        <div className="mt-3 grid grid-cols-3 text-center">
          <Macro label="protein" value={totals.p} color="text-protein" />
          <Macro label="carbs" value={totals.c} color="text-carbs" />
          <Macro label="fats" value={totals.f} color="text-fat" />
        </div>
      </Card>

      {/* Log form */}
      <Card className="p-4 space-y-1">
        <div className="flex items-center justify-between pb-1">
          <span className="text-sm text-muted">log macros (grams)</span>
          <DateField value={date} onChange={setDate} />
        </div>
        <Divider />
        <div className="py-2"><TextField value={meal} onChange={setMeal} placeholder="meal name (optional)" /></div>
        <Divider />
        <FieldRow label="protein (g)"><Stepper value={protein} onChange={setProtein} /></FieldRow>
        <Divider />
        <FieldRow label="carbs (g)"><Stepper value={carbs} onChange={setCarbs} /></FieldRow>
        <Divider />
        <FieldRow label="fats (g)"><Stepper value={fat} onChange={setFat} /></FieldRow>
        <div className="pt-3">
          <Button onClick={add} disabled={saving} className="w-full">Add entry</Button>
        </div>
      </Card>

      {/* History */}
      <div className="space-y-2">
        <span className="px-1 text-sm text-muted">history</span>
        {loading ? (
          <EmptyState>Loading…</EmptyState>
        ) : byDate.length === 0 ? (
          <EmptyState>No entries yet. Log your first meal above.</EmptyState>
        ) : (
          byDate.map(([d, items]) => {
            const cal = items.reduce((s, e) => s + macroCalories(e.protein_g, e.carbs_g, e.fat_g), 0);
            const p = items.reduce((s, e) => s + e.protein_g, 0);
            const c = items.reduce((s, e) => s + e.carbs_g, 0);
            const f = items.reduce((s, e) => s + e.fat_g, 0);
            return (
              <Card key={d} className="p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{prettyDate(d)}</span>
                  <span className="text-sm">{Math.round(cal)} kcal · {items.length} item{items.length > 1 ? "s" : ""}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">P {Math.round(p)}g · C {Math.round(c)}g · F {Math.round(f)}g</p>
                <div className="mt-2 space-y-1">
                  {items.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm text-muted">
                      <span className="truncate">
                        {e.meal_name || "meal"} — {Math.round(macroCalories(e.protein_g, e.carbs_g, e.fat_g))} kcal
                      </span>
                      <DeleteButton onDelete={() => remove(e.id)} />
                    </div>
                  ))}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{Math.round(value)}</div>
      <div className="text-xs text-muted">g</div>
    </div>
  );
}
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-base">{label}</span>
      {children}
    </div>
  );
}
function groupByDate<T extends { date: string }>(rows: T[]): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const r of rows) { const a = m.get(r.date) ?? []; a.push(r); m.set(r.date, a); }
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}
