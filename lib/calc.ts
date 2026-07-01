import { KCAL_PER_G, KCAL_PER_LB } from "./constants";
import { enumerateDays } from "./format";
import type {
  BmrEntry, WeightAnchor, MacroEntry, CardioEntry, LiftingCalorieEntry,
} from "./types";

export function macroCalories(protein: number, carbs: number, fat: number): number {
  return protein * KCAL_PER_G.protein + carbs * KCAL_PER_G.carbs + fat * KCAL_PER_G.fat;
}

// Value in effect on a given date from an effective-dated list:
// the row with the greatest effective_from that is <= date.
interface Dated { effective_from: string }
export function effectiveOn<T extends Dated>(rows: T[], date: string): T | null {
  let chosen: T | null = null;
  for (const r of rows) {
    if (r.effective_from <= date && (!chosen || r.effective_from > chosen.effective_from)) {
      chosen = r;
    }
  }
  return chosen;
}

export interface DayRow {
  date: string;
  intake: number;   // kcal in
  weights: number;  // kcal out (lifting)
  cardio: number;   // kcal out (cardio)
  bmr: number;      // kcal out (baseline, effective that day)
  net: number;      // intake - weights - cardio - bmr  (negative = deficit)
}

function sumByDate<T extends { date: string }>(rows: T[], value: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.date, (m.get(r.date) ?? 0) + value(r));
  return m;
}

/**
 * Build one DayRow per calendar day in [start, end] (inclusive).
 * Any day with no logs still appears (zeros), so trends are continuous.
 */
export function buildDailySeries(args: {
  start: string;
  end: string;
  macros: MacroEntry[];
  cardio: CardioEntry[];
  liftingCalories: LiftingCalorieEntry[];
  bmrHistory: BmrEntry[];
}): DayRow[] {
  const intakeByDate = sumByDate(args.macros, (m) => macroCalories(m.protein_g, m.carbs_g, m.fat_g));
  const cardioByDate = sumByDate(args.cardio, (c) => c.calories_burned);
  const weightsByDate = sumByDate(args.liftingCalories, (l) => l.calories_burned);

  return enumerateDays(args.start, args.end).map((date) => {
    const intake = intakeByDate.get(date) ?? 0;
    const cardio = cardioByDate.get(date) ?? 0;
    const weights = weightsByDate.get(date) ?? 0;
    const bmr = effectiveOn(args.bmrHistory, date)?.bmr ?? 0;
    return { date, intake, weights, cardio, bmr, net: intake - weights - cardio - bmr };
  });
}

export interface WeightPoint { date: string; weight: number }

/**
 * Projected weight line. Within each weight-anchor segment the weight starts at
 * the anchor value and drifts by cumulative net / 3500. Each new anchor (a
 * "weigh-in") re-baselines the line from its effective date forward.
 */
export function buildProjectedWeight(days: DayRow[], anchors: WeightAnchor[]): WeightPoint[] {
  if (anchors.length === 0) return [];
  const sorted = [...anchors].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  const out: WeightPoint[] = [];
  let baseWeight = sorted[0].weight_lb;
  let cumulative = 0; // kcal accumulated since the current anchor

  for (const day of days) {
    // Re-anchor if a weigh-in takes effect on this day.
    const anchorHere = sorted.find((a) => a.effective_from === day.date);
    if (anchorHere) { baseWeight = anchorHere.weight_lb; cumulative = 0; }
    cumulative += day.net;
    out.push({ date: day.date, weight: baseWeight + cumulative / KCAL_PER_LB });
  }
  return out;
}

/** Trailing simple moving average over `window` days (averages what's available). */
export function movingAverage(values: number[], window: number): number[] {
  if (window <= 1) return [...values];
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const from = Math.max(0, i - window + 1);
    const slice = values.slice(from, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}

/** Earliest date across all provided data, or null if there is none. */
export function earliestDate(dates: string[]): string | null {
  let min: string | null = null;
  for (const d of dates) if (!min || d < min) min = d;
  return min;
}
