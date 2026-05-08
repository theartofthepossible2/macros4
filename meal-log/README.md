# Meal Log

Photo-based meal logging for fitness coaching clients. Built around a barcode-gated
camera capture, an OpenAI vision parse, and a no-photos-at-rest data policy.

## Stack

- **Next.js 14** (App Router) on Vercel
- **Supabase** for auth, Postgres, RLS
- **OpenAI** GPT-4o vision for meal parsing
- **ZXing** for in-browser barcode reading

## Architecture at a glance

```
Client camera ──► ZXing decode (browser) ──► barcode match? ──┐
                                                              │ no
                                                              ▼
                                              UI shows mismatch / timeout
                                                              │ yes (matched)
                                                              ▼
Photo capture ──► resize to 1024px ──► /api/parse-meal ──► OpenAI vision
                                              │
                                              ▼
                            JSON schema response (items, totals, flags)
                                              │
                                              ▼
                              User edits in confirm view ──► Supabase meals row
                                              │
                                              ▼
                              Photo discarded (never persisted server-side)
```

## Why barcode-gating before capture

The shutter button is only armed once the user's known barcode is detected in
the live video stream. This:

- Eliminates "wrong client" attribution errors before any API call
- Confirms a known-size scale reference is present in frame, which the vision
  model uses to estimate portion sizes
- Filters out gaming attempts (random meal photos pulled from the web)
- Costs nothing extra — the barcode is already on the membership tag

## Why no photo persistence

Photos move from browser → API route → OpenAI and back, never landing in
Supabase Storage. Reasons:

- Privacy: meal photos can incidentally include people, locations, mail
- Storage cost: a 50-client roster at 3 meals/day is ~4,500 photos/month
- Liability surface: nothing to leak that we don't already have parsed
- OpenAI API inputs are not used for training and have a short retention window

If you later need photo persistence (e.g. for trainer review), add a private
Supabase bucket with a 24-72h TTL and RLS policies scoped to the assigned
trainer relationship. Don't enable this lightly.

## Setup

### 1. Supabase

Create a new project at supabase.com, then in the SQL editor run
`supabase/schema.sql`. This creates:

- `profiles` — one row per user, with optional `trainer_id` linkage and
  `barcode_number`
- `preferences` — display mode and units
- `meals` — every logged meal
- Auto-creates a profile and preferences row on `auth.users` insert
- Row Level Security policies so each user sees only their own data, and
  trainers see their assigned clients (read-only)

In **Auth → URL Configuration**, add your Vercel URL and `http://localhost:3000`
as redirect URLs.

### 2. OpenAI

Create an API key at platform.openai.com. The route uses `gpt-4o` with
structured outputs (JSON schema mode); make sure your key has access.

### 3. Local environment

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
  Supabase → Project Settings → API
- `OPENAI_API_KEY` from OpenAI dashboard
- `TAG_WIDTH_MM` and `TAG_HEIGHT_MM` if your membership tags are not standard
  CR80 (85×54mm)

### 4. Run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. Sign in with magic link, then go to Settings
and enter your barcode number before scanning.

> **HTTPS for camera access**: `getUserMedia` only works on `localhost` or HTTPS.
> For testing on a phone over your local network, use `next dev --experimental-https`
> or tunnel with `ngrok` / `cloudflared`.

## Deploy to Vercel

```bash
vercel
```

Set the same environment variables in the Vercel dashboard. Push to your
GitHub repo for automatic deploys.

## File map

```
app/
  api/
    auth/callback/route.ts     # Supabase magic-link return
    parse-meal/route.ts        # OpenAI vision call (the one paid endpoint)
  confirm/                     # Post-capture review + edit + log
  login/                       # Magic-link auth
  manual/                      # Nutrition-label-shaped manual entry
  scan/                        # Barcode-gated camera
  settings/                    # Barcode, display mode, units, sign out
  globals.css                  # Utilitarian visual system
  layout.tsx                   # Root shell
  page.tsx                     # Redirect to /scan or /login
components/
  CameraGate.tsx               # ZXing-driven barcode-gated capture
  TabBar.tsx                   # Bottom 3-tab navigation
lib/
  image.ts                     # Browser resize + frame capture
  prompt.ts                    # System prompt + JSON schema
  supabase-browser.ts          # Browser Supabase client
  supabase-server.ts           # Server Supabase client (cookie-based)
  types.ts                     # Shared types matching DB and API contract
supabase/
  schema.sql                   # Tables + RLS + auto-profile trigger
```

## Customizing the parse prompt

Edit `lib/prompt.ts`. The system prompt and the JSON schema travel together —
update both if you add fields. The schema is enforced via OpenAI structured
outputs (`response_format: json_schema, strict: true`), so a malformed
response is impossible by the time it reaches your code.

## Known things to decide later

- **Trainer review.** The DB and RLS already support trainer reads of client
  meals. There's no UI for it yet — that's a separate workflow once the
  client-facing POC is validated.
- **Barcode scan format.** ZXing auto-detects all common 1D and 2D formats.
  Once you confirm the gym's tag format (Code 128, Code 39, EAN-13, QR, etc.),
  pin it via the `hints` map for faster scans.
- **Tag wear escape hatch.** Settings already lets users type their barcode
  manually. Decide whether a typed-in number is treated with the same trust
  as a scanned one (currently yes).
- **Permission denied flow.** First-run camera denial currently shows a
  banner only. Add a deeper recovery flow with browser-specific instructions
  before going wide.
- **Daily/weekly summary view.** Not implemented intentionally — see the
  behavioral notes in the design memo about why a "remaining macros" widget
  on the home screen is a design liability for compliance.
