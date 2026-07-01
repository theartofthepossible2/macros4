import type { MuscleGroup } from "./constants";

export interface Profile {
  id: string;
  username: string;
  sex: "male" | "female" | "other" | null;
  height_in: number | null;
  units: string;
  onboarded_at: string | null;
  created_at: string;
}
export interface BmrEntry { id: string; effective_from: string; bmr: number; }
export interface WeightAnchor { id: string; effective_from: string; weight_lb: number; }
export interface MacroEntry {
  id: string; date: string; meal_name: string | null;
  protein_g: number; carbs_g: number; fat_g: number;
}
export interface CardioEntry { id: string; date: string; minutes: number; calories_burned: number; }
export interface LiftingCalorieEntry { id: string; date: string; calories_burned: number; }
export interface LiftingExercise {
  id: string; date: string; name: string; muscle_group: MuscleGroup;
  sets: number; reps: number;
}
