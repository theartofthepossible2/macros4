"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/UserProvider";
import { BMR_HELP_URL } from "@/lib/constants";
import { effectiveOn } from "@/lib/calc";
import { todayISO } from "@/lib/format";
import type { BmrEntry, WeightAnchor } from "@/lib/types";
import { Card, Button, NumberField, Divider } from "@/components/ui";

export function BodyInputs() {
  const { userId } = useUser();
  const supabase = useMemo(() => createClient(), []);

  const [anchors, setAnchors] = useState<WeightAnchor[]>([]);
  const [bmrHistory, setBmrHistory] = useState<BmrEntry[]>([]);
  const [weightInput, setWeightInput] = useState(0);
  const [bmrInput, setBmrInput] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [b, w] = await Promise.all([
      supabase.from("bmr_entries").select("*").order("effective_from", { ascending: true }),
      supabase.from("weight_anchors").select("*").order("effective_from", { ascending: true }),
    ]);
    const bh = (b.data as BmrEntry[]) ?? [];
    const an = (w.data as WeightAnchor[]) ?? [];
    setBmrHistory(bh);
    setAnchors(an);
    const today = todayISO();
    setWeightInput(effectiveOn(an, today)?.weight_lb ?? 0);
    setBmrInput(effectiveOn(bh, today)?.bmr ?? 0);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    setSaving(true);
    const today = todayISO();
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
    setSaving(false);
  }

  return (
    <Card className="p-4 space-y-1">
      <span className="text-sm text-muted">body</span>
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
        <Button onClick={save} disabled={saving} variant="ghost">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="pt-1 text-xs text-muted">
        Changing weight logs a weigh-in for today; the trend re-baselines from here. Past days are unchanged.
      </p>
    </Card>
  );
}
