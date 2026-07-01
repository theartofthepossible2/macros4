"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/UserProvider";
import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/constants";
import { todayISO, prettyDate } from "@/lib/format";
import type { LiftingCalorieEntry, LiftingExercise } from "@/lib/types";
import {
  Card, ScreenTitle, Button, Stepper, NumberField, TextField, DateField,
  DeleteButton, EmptyState, Divider,
} from "@/components/ui";

export default function LiftingPage() {
  const { userId } = useUser();
  const supabase = useMemo(() => createClient(), []);
  const [cals, setCals] = useState<LiftingCalorieEntry[]>([]);
  const [exercises, setExercises] = useState<LiftingExercise[]>([]);
  const [loading, setLoading] = useState(true);

  // calorie form
  const [calDate, setCalDate] = useState(todayISO());
  const [calories, setCalories] = useState(0);
  const [savingCal, setSavingCal] = useState(false);

  // exercise form
  const [exDate, setExDate] = useState(todayISO());
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup>("chest");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [savingEx, setSavingEx] = useState(false);

  async function load() {
    const [c, e] = await Promise.all([
      supabase.from("lifting_calorie_entries").select("*")
        .order("date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("lifting_exercises").select("*")
        .order("date", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    setCals((c.data as LiftingCalorieEntry[]) ?? []);
    setExercises((e.data as LiftingExercise[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const today = todayISO();
  const burnedToday = cals.filter((c) => c.date === today).reduce((s, c) => s + c.calories_burned, 0);

  async function addCalories() {
    if (calories === 0) return;
    setSavingCal(true);
    await supabase.from("lifting_calorie_entries").insert({
      user_id: userId, date: calDate, calories_burned: calories,
    });
    setCalories(0);
    await load();
    setSavingCal(false);
  }
  async function addExercise() {
    if (!name.trim()) return;
    setSavingEx(true);
    await supabase.from("lifting_exercises").insert({
      user_id: userId, date: exDate, name: name.trim(), muscle_group: muscle, sets, reps,
    });
    setName(""); setSets(3); setReps(10);
    await load();
    setSavingEx(false);
  }
  const removeCal = async (id: string) => { await supabase.from("lifting_calorie_entries").delete().eq("id", id); load(); };
  const removeEx = async (id: string) => { await supabase.from("lifting_exercises").delete().eq("id", id); load(); };

  const exByDate = groupByDate(exercises);

  return (
    <div className="space-y-5">
      <ScreenTitle>lifting</ScreenTitle>

      <Card className="p-4 flex items-baseline justify-between">
        <span className="font-semibold">today&apos;s burn</span>
        <span className="text-2xl font-bold text-good">{burnedToday} kcal</span>
      </Card>

      {/* Weights calories (feeds the net) */}
      <Card className="p-4 space-y-1">
        <div className="flex items-center justify-between pb-1">
          <span className="text-sm text-muted">log calories burned</span>
          <DateField value={calDate} onChange={setCalDate} />
        </div>
        <Divider />
        <div className="flex items-center justify-between py-2">
          <span className="text-base">calories</span>
          <NumberField value={calories} onChange={setCalories} suffix="kcal" max={20000} />
        </div>
        <div className="pt-3">
          <Button onClick={addCalories} disabled={savingCal} className="w-full">Add calories</Button>
        </div>
      </Card>

      {/* Exercise log */}
      <Card className="p-4 space-y-1">
        <div className="flex items-center justify-between pb-1">
          <span className="text-sm text-muted">log exercise</span>
          <DateField value={exDate} onChange={setExDate} />
        </div>
        <Divider />
        <div className="py-2"><TextField value={name} onChange={setName} placeholder="exercise (e.g. bench press)" /></div>
        <Divider />
        <div className="flex items-center justify-between py-2">
          <span className="text-base">muscle</span>
          <select
            value={muscle}
            onChange={(e) => setMuscle(e.target.value as MuscleGroup)}
            className="rounded-lg bg-cardhi px-3 py-1.5 text-sm capitalize outline-none"
          >
            {MUSCLE_GROUPS.map((m) => (
              <option key={m} value={m} className="capitalize">{m}</option>
            ))}
          </select>
        </div>
        <Divider />
        <div className="flex items-center justify-between py-2">
          <span className="text-base">sets</span>
          <Stepper value={sets} onChange={setSets} min={1} />
        </div>
        <Divider />
        <div className="flex items-center justify-between py-2">
          <span className="text-base">reps</span>
          <Stepper value={reps} onChange={setReps} min={1} />
        </div>
        <div className="pt-3">
          <Button onClick={addExercise} disabled={savingEx} className="w-full">Add exercise</Button>
        </div>
      </Card>

      {/* Calorie history */}
      {cals.length > 0 && (
        <div className="space-y-2">
          <span className="px-1 text-sm text-muted">calorie history</span>
          {groupByDate(cals).map(([d, items]) => (
            <Card key={d} className="p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{prettyDate(d)}</span>
                <span className="text-sm text-good">{items.reduce((s, e) => s + e.calories_burned, 0)} kcal</span>
              </div>
              <div className="mt-2 space-y-1">
                {items.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm text-muted">
                    <span>{e.calories_burned} kcal</span>
                    <DeleteButton onDelete={() => removeCal(e.id)} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Exercise history */}
      <div className="space-y-2">
        <span className="px-1 text-sm text-muted">exercise history</span>
        {loading ? (
          <EmptyState>Loading…</EmptyState>
        ) : exByDate.length === 0 ? (
          <EmptyState>No exercises logged yet.</EmptyState>
        ) : (
          exByDate.map(([d, items]) => (
            <Card key={d} className="p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{prettyDate(d)}</span>
                <span className="text-sm text-muted">{items.length} exercise{items.length > 1 ? "s" : ""}</span>
              </div>
              <div className="mt-2 space-y-1">
                {items.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">
                      {e.name} <span className="text-muted capitalize">· {e.muscle_group}</span>
                    </span>
                    <span className="flex items-center gap-3 text-muted">
                      <span>{e.sets}×{e.reps}</span>
                      <DeleteButton onDelete={() => removeEx(e.id)} />
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))
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
