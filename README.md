# macros4

A minimal calorie/energy-balance tracker. Rebuild of an iOS app as a Next.js + TypeScript web app backed by Supabase, deployable to Vercel.

Four tabs: **lifting**, **cardio**, **macros**, **progress**. Login is username + password.

## The model

Everything derives from one equation, computed on read (never stored):

```
daily net = intake − weights − cardio − BMR
```

- **intake** = macro calories, `protein×4 + carbs×4 + fat×9`
- **weights** = manually logged lifting calories burned
- **cardio** = cardio calories burned
- **BMR** = your basal rate, entered directly (effective-dated)
- **net < 0** is a deficit (green), **net > 0** a surplus (red)

**Projected weight** = `starting weight + (cumulative net ÷ 3500 kcal/lb)`. Weight is projected from calories; there are no scale weigh-ins. Your **weight** and **BMR** are effective-dated: changing weight writes a new anchor (acts as a weigh-in) and the trend re-baselines from that date forward; changing BMR affects that date forward only. History is never rewritten.

## Setup (about 5 minutes)

### 1. Create a Supabase project
At [supabase.com](https://supabase.com), create a new project.

### 2. Run the schema
Open **SQL Editor** in the Supabase dashboard, paste the contents of
`supabase/migrations/0001_init.sql`, and run it. This creates all tables,
row-level security (each user sees only their own data), and a trigger that
creates a profile row on signup.

### 3. Turn off email confirmation
**Authentication → Providers → Email**, disable **Confirm email**.
Login is by username, mapped internally to a non-deliverable address
(`username@macros4.test`), so no confirmation email can be delivered. If your
project rejects that domain at signup, change `AUTH_EMAIL_DOMAIN` in
`lib/constants.ts` to any valid domain.

### 4. Environment variables
Copy the example and fill in your project values (Supabase → **Settings → API**):

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

### 5. Run it
```bash
npm install
npm run dev
```

Open http://localhost:3000, create an account, and complete onboarding
(sex, height, starting weight, BMR).

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add the same two environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings.
4. Deploy.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** (dark, minimal theme)
- **Supabase** Postgres + Auth (`@supabase/ssr` for cookie sessions; RLS for isolation)
- **Recharts** for the progress chart

## Notes / roadmap

- **Lifting** is log-only in v1. Exercises are stored with `muscle_group / sets /
  reps` in clean relational rows, so a muscle-balance view can be built later
  purely from the data — no schema change needed.
- Height and sex are collected at onboarding and stored for future use; the v1
  net uses your directly-entered BMR, not a computed one.
- v1 is imperial (lb). A metric toggle is a natural next addition.
- This is v1 and hasn't been run against a live Supabase instance yet — run it
  locally first (step 5) to confirm before deploying.
