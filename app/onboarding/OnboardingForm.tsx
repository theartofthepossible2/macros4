"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BMR_HELP_URL } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { Card, Button, NumberField, Segmented, Divider } from "@/components/ui";

export default function OnboardingForm({ username }: { username: string }) {
  const router = useRouter();
  const [sex, setSex] = useState<"male" | "female" | "other">("male");
  const [feet, setFeet] = useState(5);
  const [inches, setInches] = useState(10);
  const [weight, setWeight] = useState(180);
  const [bmr, setBmr] = useState(1800);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const heightIn = feet * 12 + inches;
    const today = todayISO();

    const p = await supabase.from("profiles").update({
      sex, height_in: heightIn, units: "imperial", onboarded_at: new Date().toISOString(),
    }).eq("id", user.id);

    const b = await supabase.from("bmr_entries").insert({
      user_id: user.id, effective_from: today, bmr,
    });
    const w = await supabase.from("weight_anchors").insert({
      user_id: user.id, effective_from: today, weight_lb: weight,
    });

    const err = p.error || b.error || w.error;
    if (err) { setError(err.message); setSaving(false); return; }

    router.push("/macros");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md px-5 py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Welcome, {username}</h1>
        <p className="text-sm text-muted">Set your stats to get started. You can change these anytime.</p>
      </div>

      <Card className="px-4 divide-y divide-line/60">
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-muted">sex</span>
          <Segmented
            value={sex}
            onChange={setSex}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-muted">height</span>
          <div className="flex items-center gap-2">
            <NumberField value={feet} onChange={setFeet} min={0} max={8} suffix="ft" />
            <NumberField value={inches} onChange={setInches} min={0} max={11} suffix="in" />
          </div>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-muted">starting weight</span>
          <NumberField value={weight} onChange={setWeight} min={40} max={1200} suffix="lb" />
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-muted">bmr</span>
          <NumberField value={bmr} onChange={setBmr} min={500} max={6000} suffix="kcal/day" />
        </div>
      </Card>

      <a
        href={BMR_HELP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block px-1 text-sm text-accent"
      >
        What&apos;s my BMR? (Katch-McArdle) →
      </a>

      {error ? <p className="px-1 text-sm text-bad">{error}</p> : null}

      <Button onClick={save} disabled={saving} className="w-full py-3">
        {saving ? "Saving…" : "Start tracking"}
      </Button>
    </main>
  );
}
