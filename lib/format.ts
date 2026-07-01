export function pad(n: number): string { return String(n).padStart(2, "0"); }

// Local (not UTC) yyyy-mm-dd for a Date.
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO(): string { return toISODate(new Date()); }

// Parse a yyyy-mm-dd as a stable UTC-noon Date (avoids DST/tz off-by-one).
export function parseISO(iso: string): Date { return new Date(`${iso}T12:00:00Z`); }

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}

// Inclusive list of yyyy-mm-dd from start..end.
export function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 4000) { out.push(cur); cur = addDays(cur, 1); guard++; }
  return out;
}

// "Jun 4, 2026"
export function prettyDate(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}
// "Jun 4"
export function shortDate(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC",
  });
}

export function signed(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : `${r}`;
}
