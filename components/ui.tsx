"use client";
import { useState } from "react";

/** Digits only (plus one "." when decimals allowed), leading zeros stripped. */
function sanitizeNumeric(raw: string, integer: boolean): string {
  let s = raw.replace(integer ? /[^\d]/g : /[^\d.]/g, "");
  if (!integer) {
    const dot = s.indexOf(".");
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  }
  return s.replace(/^0+(?=\d)/, "");
}

/**
 * Draft-string editing for numeric inputs: while focused the field shows raw
 * typed text (so backspacing and partial values are never clamped mid-keystroke);
 * valid values commit live, and the display snaps to the clamped value on blur.
 */
function useNumericDraft({
  value, onChange, min, max, integer,
}: {
  value: number; onChange: (v: number) => void;
  min: number; max: number; integer: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return {
    type: "text" as const,
    inputMode: integer ? ("numeric" as const) : ("decimal" as const),
    value: draft ?? String(Number.isFinite(value) ? value : 0),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      setDraft(String(Number.isFinite(value) ? value : 0));
      e.currentTarget.select();
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const s = sanitizeNumeric(e.target.value, integer);
      setDraft(s);
      const n = Number(s);
      if (s !== "" && Number.isFinite(n)) onChange(clamp(n));
    },
    onBlur: () => setDraft(null),
  };
}

export function Card({
  children, className = "",
}: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-card border border-line/60 ${className}`}>{children}</div>
  );
}

export function ScreenTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-3xl font-bold tracking-tight px-1">{children}</h1>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-muted">{children}</span>;
}

export function Button({
  children, onClick, type = "button", variant = "primary", disabled, className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: "bg-accent text-white hover:brightness-110",
    ghost: "bg-cardhi text-white hover:bg-line",
    danger: "bg-transparent text-bad hover:bg-bad/10",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:pointer-events-none ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/** Compact −/+ stepper for small integer counts (macros, sets, reps, minutes). */
export function Stepper({
  value, onChange, min = 0, max = 100000, step = 1,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const inputProps = useNumericDraft({ value, onChange, min, max, integer: true });
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="decrease"
        onClick={() => onChange(clamp(value - step))}
        className="h-9 w-9 rounded-lg bg-cardhi text-lg leading-none hover:bg-line"
      >
        −
      </button>
      <input
        {...inputProps}
        className="w-16 bg-transparent text-center text-lg font-semibold outline-none"
      />
      <button
        type="button"
        aria-label="increase"
        onClick={() => onChange(clamp(value + step))}
        className="h-9 w-9 rounded-lg bg-cardhi text-lg leading-none hover:bg-line"
      >
        +
      </button>
    </div>
  );
}

/** Free numeric field for larger values (calories, weight, bmr). */
export function NumberField({
  value, onChange, min = 0, max = 100000, suffix, className = "",
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; suffix?: string; className?: string;
}) {
  const inputProps = useNumericDraft({ value, onChange, min, max, integer: false });
  return (
    <div className={`flex items-baseline gap-1.5 ${className}`}>
      <input
        {...inputProps}
        className="w-24 bg-transparent text-right text-lg font-semibold outline-none"
      />
      {suffix ? <span className="text-sm text-muted">{suffix}</span> : null}
    </div>
  );
}

export function TextField({
  value, onChange, placeholder, className = "",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-transparent text-base outline-none placeholder:text-muted/70 ${className}`}
    />
  );
}

export function DateField({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg bg-cardhi px-3 py-1.5 text-sm outline-none"
    />
  );
}

export function Row({
  label, children, className = "",
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-3 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Divider() { return <div className="h-px bg-line/60" />; }

/** Pill segmented control. */
export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-cardhi p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === o.value ? "bg-line text-white" : "text-muted hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-6 text-center text-sm text-muted">{children}</p>;
}

export function DeleteButton({ onDelete }: { onDelete: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-label="delete"
      disabled={busy}
      onClick={async () => { setBusy(true); try { await onDelete(); } finally { setBusy(false); } }}
      className="text-muted hover:text-bad disabled:opacity-40 text-lg leading-none px-1"
    >
      ×
    </button>
  );
}
