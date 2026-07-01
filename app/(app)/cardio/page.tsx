"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/UserProvider";
import { todayISO, prettyDate } from "@/lib/format";
import type { CardioEntry } from "@/lib/types";
import {
  Card, ScreenTitle, Button, Stepper, NumberField, DateField, DeleteButton, EmptyState, Divider,
} from "@/components/ui";

export default function CardioPage() {
  const { userId } = useUser();
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<CardioEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(todayISO());
  const [minutes, setMinutes] = useState(0);
  const [calories, setCalories] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("cardio_entries").select("*")
      .order("date", { ascending: false }).order("created_at", { ascending: false });
    setEntries((data as CardioEntry[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const today = todayISO();
  const burnedToday = entries.filter((e) => e.date === today).reduce((s, e) => s + e.calories_burned, 0);

  async function add() {
    if (calories === 0 && minutes === 0) return;
    setSaving(true);
    await supabase.from("cardio_entries").insert({
      user_id: userId, date, minutes, calories_burned: calories,
    });
    setMinutes(0); setCalories(0);
    await load();
    setSaving(false);
  }
  async function remove(id: string) {
    await supabase.from("cardio_entries").delete().eq("id", id);
    await load();
  }

  const byDate = groupByDate(entries);

  return (
    <div className="space-y-5">
      <ScreenTitle>cardio</ScreenTitle>

      <Card className="p-4 flex items-baseline justify-between">
        <span className="font-semibold">today&apos;s burn</span>
        <span className="text-2xl font-bold text-good">{burnedToday} kcal</span>
      </Card>

      <Card className="p-4 space-y-1">
        <div className="flex items-center justify-between pb-1">
          <span className="text-sm text-muted">log cardio</span>
          <DateField value={date} onChange={setDate} />
        </div>
        <Divider />
        <div className="flex items-center justify-between py-2">
          <span className="text-base">minutes</span>
          <Stepper value={minutes} onChange={setMinutes} step={1} />
        </div>
        <Divider />
        <div className="flex items-center justify-between py-2">
          <span className="text-base">calories burned</span>
          <NumberField value={calories} onChange={setCalories} suffix="kcal" max={20000} />
        </div>
        <div className="pt-3">
          <Button onClick={add} disabled={saving} className="w-full">Add entry</Button>
        </div>
      </Card>

      <div className="space-y-2">
        <span className="px-1 text-sm text-muted">history</span>
        {loading ? (
          <EmptyState>Loading…</EmptyState>
        ) : byDate.length === 0 ? (
          <EmptyState>No cardio logged yet.</EmptyState>
        ) : (
          byDate.map(([d, items]) => {
            const cal = items.reduce((s, e) => s + e.calories_burned, 0);
            const mins = items.reduce((s, e) => s + e.minutes, 0);
            return (
              <Card key={d} className="p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{prettyDate(d)}</span>
                  <span className="text-sm text-good">{cal} kcal</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">{mins} min · {items.length} entr{items.length > 1 ? "ies" : "y"}</p>
                <div className="mt-2 space-y-1">
                  {items.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm text-muted">
                      <span>{e.minutes} min — {e.calories_burned} kcal</span>
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

function groupByDate<T extends { date: string }>(rows: T[]): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const r of rows) { const a = m.get(r.date) ?? []; a.push(r); m.set(r.date, a); }
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}
