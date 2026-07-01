// Auth: Supabase Auth requires an email, but this app logs in by username.
// We map a username to a deterministic, non-deliverable email under a reserved
// TLD (.test, RFC 2606). No email is ever sent; disable "Confirm email" in
// Supabase Auth settings. Change this domain if your setup rejects it.
export const AUTH_EMAIL_DOMAIN = "macros4.test";

export function toAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

// Energy model
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;
export const KCAL_PER_LB = 3500; // Wishnofsky rule for projected weight change

export const MUSCLE_GROUPS = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "glutes", "quadriceps", "hamstrings", "calves", "core",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

// External helper for users computing their own BMR (Katch-McArdle).
export const BMR_HELP_URL = "https://www.omnicalculator.com/health/bmr-katch-mcardle";
