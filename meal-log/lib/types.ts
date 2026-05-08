export type Confidence = "high" | "medium" | "low";

export type ParsedItem = {
  name: string;
  estimated_grams: number;
  confidence: Confidence;
};

export type ParsedTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

export type ParseFlag =
  | "no_tag_visible"
  | "partial_plate"
  | "low_light"
  | "obscured_items"
  | "unfamiliar_dish"
  | "liquid_only";

export type ParsedMeal = {
  items: ParsedItem[];
  totals: ParsedTotals;
  scale_reference: { tag_detected: boolean; tag_barcode: string | null };
  flags: ParseFlag[];
  notes: string;
};

export type DisplayMode =
  | "calories_only"
  | "calories_protein"
  | "full_macros"
  | "macros_fiber";

export type UnitSystem = "metric" | "imperial";

export type Preferences = {
  user_id: string;
  display_mode: DisplayMode;
  units: UnitSystem;
};

export type Profile = {
  id: string;
  full_name: string | null;
  trainer_id: string | null;
  is_trainer: boolean;
  barcode_number: string | null;
};
