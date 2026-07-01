"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/UserProvider";
import { BMR_HELP_URL, KCAL_PER_LB } from "@/lib/constants";
import {
  buildDailySeries, buildProjectedWeight, movingAverage, effectiveOn, earliestDate,
  type DayRow,
} from "@/lib/calc";
import { todayISO, addDays, prettyDate, signed } from "@/lib/format";
import type {
  BmrEntry, WeightAnchor, MacroEntry, CardioEntry, LiftingCalorieEntry,
} from "@/lib/types";
import { ProgressChart, type ChartPoint } from "@/components/ProgressChart";
import {
  Card, ScreenTitle, Button, NumberField, Segmented, DateField, EmptyState, Divider,
} from "@/components/ui";

type Metric = "net" | "weight";
type RangeKey = "14" | "30" | "90" | "all" | "custom";

export default function ProgressPage() {
  const { userId } = useUser();
  const supabase = useMemo(() => createClient(), []);

  const [bmrHistory, setBmrHistory] = useState<BmrEntry[]>([]);
  const [anchors, setAnchors] = useState<WeightAnchor[]>([]);
  const [macros, setMacros] = useState<MacroEntry[]>([]);
  const [cardio, setCardio] = useState<CardioEntry[]>([]);
  const [lifting, setLifting] = useState<LiftingCalorieEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // controls
  const [metric, setMetric] = useState<Metric>("weight");
  const [windowN, setWindowN] = useState(7);
  const [rangeKey, setRangeKey] = useState<RangeKey>("30");
  const [customStart, setCustomStart] = useState(addDays(todayISO(), -30));
  const [customEnd, setCustomEnd] = useState(todayISO());

  // inputs (weight + bmr editing)
  const [weightInput, setWeightInput] = useState(0);
  const [bmrInput, setBmrInput] = useState(0);
  const [savingInputs, setSavingInputs] = useState(false);

  async function load() {
    const [b, w, m, c, l] = await Promise.all([
      supabase.from("bmr_entries").select("*").order("effective_from", { ascending: true }),
      supabase.from("weight_anchors").select("*").order("effective_from", { ascending: true }),
      supabase.from("macro_entries").select("*"),
      supabase.from("cardio_entries").select("*"),
      supabase.from("lifting_calorie_entries").select("*"),
    ]);
    const bh = (b.data as BmrEntry[]) ?? [];
    const an = (w.data as WeightAnchor[]) ?? [];
    setBmrHistory(bh);
    setAnchors(an);
    setMacros((m.data as MacroEntry[]) ?? []);
    setCardio((c.data as CardioEntry[]) ?? []);
    setLifting((l.data as LiftingCalorieEntry[]) ?? []);
    const today = todayISO();
    setWeightInput(effectiveOn(an, today)?.weight_lb ?? 0);
    setBmrInput(effectiveOn(bh, today)?.bmr ?? 0);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Full continuous series from earliest data to today.
  const today = todayISO();
  const start = useMemo(() => {
    const dates = [
      ...anchors.map((a) => a.effective_from),
      ...bmrHistory.map((x) => x.effective_from),
      ...macros.map((x) => x.date),
      ...cardio.map((x) => x.date),
      ...lifting.map((x) => x.date),
    ];
    return earliestDate(dates) ?? today;
  }, [anchors, bmrHistory, macros, cardio, lifting, today]);

  const days: DayRow[] = useMemo(
    () => buildDailySeries({
      start, end: today, macros, cardio, liftingCalories: lifting, bmrHistory,
    }),
    [start, today, macros, cardio, lifting, bmrHistory],
  );
  const weightSeries = useMemo(() => buildProjectedWeight(days, anchors), [days, anchors]);

  // Moving averages over the full series (so the average is correct at range edges).
  const netMA = useMemo(() => movingAverage(days.map((d) => d.net), windowN), [days, windowN]);
  const weightMA = useMemo(
    () => movingAverage(weightSeries.map((p) => p.weight), windowN),
    [weightSeries, windowN],
  );

  // Resolve display range.
  const [rangeStart, rangeEnd] = useMemo<[string, string]>(() => {
    if (rangeKey === "all") return [start, today];
    if (rangeKey === "custom") return [customStart, customEnd];
    return [addDays(today, -(Number(rangeKey) - 1)), today];
  }, [rangeKey, start, today, customStart, customEnd]);

  const inRange = (d: string) => d >= rangeStart && d <= rangeEnd;

  const chartData: ChartPoint[] = useMemo(() => {
    return days.map((d, i) => ({
      date: d.date,
      raw: metric === "net" ? d.net : weightSeries[i]?.weight ?? 0,
      ma: metric === "net" ? netMA[i] : weightMA[i],
    })).filter((p) => inRange(p.date));
    /* eslint-disable-next-line */
  }, [days, weightSeries, netMA, weightMA, metric, rangeStart, rangeEnd]);

  const visibleDays = days.filter((d) => inRange(d.date));
  const cumulativeNet = visibleDays.reduce((s, d) => s + d.net, 0);
  const weightDelta = (() => {
    const pts = weightSeries.filter((p) => inRange(p.date));
    if (pts.length < 2) return cumulativeNet / KCAL_PER_LB;
    return pts[pts.length - 1].weight - pts[0].weight;
  })();

  const smoothKey: "3" | "7" | "custom" = windowN === 3 ? "3" : windowN === 7 ? "7" : "custom";

  async function saveInputs() {
    setSavingInputs(true);
    const curWeight = effectiveOn(anchors, today)?.weight_lb ?? null;
    const curBmr = effectiveOn(bmrHistory, today)?.bmr ?? null;
    if (weightInput > 0 && weightInput !== curWeight) {
      await supabase.from("weight_anchors").upsert(
        { user_id: userId, effective_from: today, weight_lb: weightInput },
        { onConflict: "user_id,effective_from" },
      );
    }
    if (bmrInput > 0 && bmrInput !== curBmr) {
      await supabase.from("bmr_entries").upsert(
        { user_id: userId, effective_from: today, bmr: bmrInput },
        { onConflict: "user_id,effective_from" },
      );
    }
    await load();
    setSavingInputs(false);
  }

  return (
    <div className="space-y-5">
      <ScreenTitle>progress</ScreenTitle>

      {/* Inputs */}
      <Card className="p-4 space-y-1">
        <span className="text-sm text-muted">inputs</span>
        <Divider />
        <div className="flex items-center justify-between py-2">
          <span className="text-base">current weight</span>
          <NumberField value={weightInput} onChange={setWeightInput} min={40} max={1200} suffix="lb" />
        </div>
        <Divider />
        <div className="flex items-center justify-between py-2">
          <span className="text-base">bmr</span>
          <NumberField value={bmrInput} onChange={setBmrInput} min={500} max={6000} suffix="kcal/day" />
        </div>
        <div className="flex items-center justify-between gap-3 pt-3">
          <a href={BMR_HELP_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-accent">
            What&apos;s my BMR? →
          </a>
          <Button onClick={saveInputs} disabled={savingInputs} variant="ghost">
            {savingInputs ? "Saving…" : "Save"}
          </Button>
        </div>
        <p className="pt-1 text-xs text-muted">
          Changing weight logs a weigh-in for today; the trend re-baselines from here. Past days are unchanged.
        </p>
      </Card>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={metric} onChange={setMetric}
          options={[{ value: "weight", label: "Weight (lb)" }, { value: "net", label: "Net (kcal)" }]}
        />
        <Segmented
          value={smoothKey}
          onChange={(v) => {
            if (v === "3") setWindowN(3);
            else if (v === "7") setWindowN(7);
            else if (windowN === 3 || windowN === 7) setWindowN(14);
          }}
          options={[{ value: "3", label: "3-day" }, { value: "7", label: "7-day" }, { value: "custom", label: "Custom" }]}
        />
        {smoothKey === "custom" ? (
          <div className="flex items-center gap-1 rounded-xl bg-cardhi px-3 py-1.5 text-sm">
            <span className="text-muted">avg</span>
            <NumberField value={windowN} onChange={(v) => setWindowN(Math.max(1, v))} min={1} max={90} className="!gap-0" />
            <span className="text-muted">d</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={rangeKey} onChange={setRangeKey}
          options={[
            { value: "14", label: "14d" }, { value: "30", label: "30d" },
            { value: "90", label: "90d" }, { value: "all", label: "All" },
            { value: "custom", label: "Custom" },
          ]}
        />
      </div>
      {rangeKey === "custom" ? (
        <div className="flex items-center gap-2 px-1 text-sm text-muted">
          <DateField value={customStart} onChange={setCustomStart} />
          <span>to</span>
          <DateField value={customEnd} onChange={setCustomEnd} />
        </div>
      ) : null}

      {/* Chart */}
      <Card className="p-3">
        <div className="px-1 pb-1 text-sm font-semibold">
          {metric === "weight" ? "projected weight" : "daily net"}
        </div>
        {loading ? (
          <div className="grid h-52 place-items-center text-sm text-muted">Loading…</div>
        ) : (
          <ProgressChart data={chartData} isWeight={metric === "weight"} />
        )}
        <div className="flex justify-between px-1 pt-2 text-xs text-muted">
          <span>cumulative net: {Math.round(cumulativeNet).toLocaleString()} kcal</span>
          <span>Δ weight: {signed(weightDelta)} lb</span>
        </div>
      </Card>

      {/* Daily net breakdown */}
      <div className="space-y-2">
        <span className="px-1 text-sm text-muted">daily net</span>
        {loading ? (
          <EmptyState>Loading…</EmptyState>
        ) : visibleDays.length === 0 ? (
          <EmptyState>No days in this range.</EmptyState>
        ) : (
          <Card className="divide-y divide-line/60">
            {[...visibleDays].reverse().map((d) => (
              <div key={d.date} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{prettyDate(d.date)}</div>
                  <div className="truncate text-xs text-muted">
                    {Math.round(d.intake).toLocaleString()} in − {Math.round(d.weights).toLocaleString()} weights − {Math.round(d.cardio).toLocaleString()} cardio − {Math.round(d.bmr).toLocaleString()} bmr
                  </div>
                </div>
                <div className={`text-sm font-semibold ${d.net < 0 ? "text-good" : d.net > 0 ? "text-bad" : "text-muted"}`}>
                  {Math.round(d.net).toLocaleString()}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
