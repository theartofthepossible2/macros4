"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { shortDate } from "@/lib/format";

export interface ChartPoint { date: string; raw: number; ma: number }

export function ProgressChart({
  data, isWeight,
}: { data: ChartPoint[]; isWeight: boolean }) {
  if (data.length === 0) {
    return <div className="grid h-52 place-items-center text-sm text-muted">Not enough data yet.</div>;
  }
  const fmt = (v: number) =>
    isWeight ? `${v.toFixed(1)} lb` : `${Math.round(v)} kcal`;

  // Show roughly 5 date ticks.
  const step = Math.max(1, Math.floor(data.length / 5));
  const ticks = data.filter((_, i) => i % step === 0).map((d) => d.date);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid stroke="#2a2a2e" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="date" ticks={ticks} tickFormatter={shortDate}
          tick={{ fill: "#8a8a90", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={12}
        />
        <YAxis
          domain={isWeight ? ["dataMin - 1", "dataMax + 1"] : ["auto", "auto"]}
          tick={{ fill: "#8a8a90", fontSize: 11 }} axisLine={false} tickLine={false} width={48}
          tickFormatter={(v) => (isWeight ? Number(v).toFixed(0) : String(Math.round(Number(v))))}
        />
        <Tooltip
          contentStyle={{ background: "#161618", border: "1px solid #2a2a2e", borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: "#8a8a90" }}
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(value: number, name) => [fmt(value), name === "ma" ? "average" : "daily"]}
        />
        {/* raw = dotted */}
        <Line type="monotone" dataKey="raw" stroke="#2f9bff" strokeWidth={1.5}
          strokeDasharray="3 3" dot={false} isAnimationActive={false} />
        {/* moving average = bold */}
        <Line type="monotone" dataKey="ma" stroke="#2f9bff" strokeWidth={3}
          dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
