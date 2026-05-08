import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server";
import { SYSTEM_PROMPT, RESPONSE_SCHEMA, validateParsedMeal } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  // Auth check
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate body
  let body: { image?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { image, description } = body;
  if (!image || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "Missing or invalid image" }, { status: 400 });
  }
  if (!description || description.trim().length === 0) {
    return NextResponse.json({ error: "Missing description" }, { status: 400 });
  }

  // Confirm user has a barcode set (defense-in-depth; client also gates this)
  const { data: profile } = await supabase
    .from("profiles")
    .select("barcode_number")
    .eq("id", user.id)
    .single();
  if (!profile?.barcode_number) {
    return NextResponse.json({ error: "No barcode on file" }, { status: 400 });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image, detail: "high" } },
            { type: "text", text: `User says this meal contains: ${description.trim()}` },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "parsed_meal",
          schema: RESPONSE_SCHEMA,
          strict: true,
        },
      },
      temperature: 0.2,
      max_tokens: 800,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
    }
    const parsed = JSON.parse(raw);
    if (!validateParsedMeal(parsed)) {
      return NextResponse.json({ error: "Malformed response" }, { status: 502 });
    }

    // Stamp the verified barcode onto the response — the model is instructed
    // not to attempt OCR on the tag, so we authoritatively attach it here.
    parsed.scale_reference = {
      tag_detected: parsed.scale_reference?.tag_detected ?? true,
      tag_barcode: profile.barcode_number,
    };

    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("parse-meal error:", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Parse failed" },
      { status: 500 }
    );
  }
  // Note: we never persist the image. It exists only in this request scope.
}
