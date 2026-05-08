import type { ParsedMeal } from "./types";

const TAG_W = process.env.TAG_WIDTH_MM || "85";
const TAG_H = process.env.TAG_HEIGHT_MM || "54";

export const SYSTEM_PROMPT = `You are a nutrition estimation assistant analyzing photos of meals taken by clients of a fitness coaching service.

A membership tag with known dimensions (${TAG_W}mm x ${TAG_H}mm) is in frame as a scale reference. Use the tag's apparent size in the image to calibrate portion estimates. The barcode value on the tag has already been verified against the user's account before this call — you do not need to read it.

For each food item visible:
- Identify the item, prioritizing the user's description when ambiguous
- Estimate weight in grams using the tag for scale
- Assign confidence: "high" for clearly visible items with reliable scale reference, "medium" for items partially obscured or with ambiguous preparation, "low" for items you cannot confidently identify or measure
- Assume lean preparation methods unless the photo clearly shows otherwise (visible oil pooling, breading, heavy sauce coverage)

Compute totals using standard USDA nutrient values. Round all numeric values to integers.

Use these flags when applicable:
- no_tag_visible: tag is missing from frame despite the pre-check (rare; report it)
- partial_plate: portion of the meal extends out of frame
- low_light: lighting impairs identification
- obscured_items: items hidden by other foods or garnish
- unfamiliar_dish: dish is uncommon and identification is uncertain
- liquid_only: photo contains only beverages

Be honest about uncertainty. If you cannot estimate a portion confidently, mark it low confidence rather than guessing precisely. The notes field should briefly explain assumptions you made (preparation method, hidden ingredients you inferred, etc.). Keep notes under 200 characters.

Return only valid JSON. Do not include any text outside the JSON object.`;

export const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          estimated_grams: { type: "integer", minimum: 0 },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["name", "estimated_grams", "confidence"],
      },
    },
    totals: {
      type: "object",
      additionalProperties: false,
      properties: {
        calories: { type: "integer", minimum: 0 },
        protein_g: { type: "integer", minimum: 0 },
        carbs_g: { type: "integer", minimum: 0 },
        fat_g: { type: "integer", minimum: 0 },
        fiber_g: { type: "integer", minimum: 0 },
      },
      required: ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g"],
    },
    scale_reference: {
      type: "object",
      additionalProperties: false,
      properties: {
        tag_detected: { type: "boolean" },
        tag_barcode: { type: ["string", "null"] },
      },
      required: ["tag_detected", "tag_barcode"],
    },
    flags: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "no_tag_visible",
          "partial_plate",
          "low_light",
          "obscured_items",
          "unfamiliar_dish",
          "liquid_only",
        ],
      },
    },
    notes: { type: "string" },
  },
  required: ["items", "totals", "scale_reference", "flags", "notes"],
} as const;

export function validateParsedMeal(data: unknown): data is ParsedMeal {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.items) &&
    typeof d.totals === "object" &&
    typeof d.scale_reference === "object" &&
    Array.isArray(d.flags) &&
    typeof d.notes === "string"
  );
}
