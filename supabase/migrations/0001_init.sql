-- macros4 schema
-- Run this in the Supabase SQL editor (or via the CLI) once, on a fresh project.
-- Every table is scoped to the authenticated user via RLS: a user can only ever
-- read/write their own rows.

-- ----------------------------------------------------------------------------
-- profiles: one row per auth user. Static-ish stats live here. Weight and BMR
-- are NOT stored here because they are effective-dated (see below).
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique not null,
  sex          text check (sex in ('male', 'female', 'other')),
  height_in    numeric,                       -- height in inches (imperial v1)
  units        text not null default 'imperial',
  onboarded_at timestamptz,                   -- null => must go through onboarding
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- bmr_entries: effective-dated BMR. A day's net uses the BMR whose
-- effective_from is the latest date <= that day. Editing BMR = inserting a new
-- row effective today; past days keep their historical value. History is never
-- mutated.
-- ----------------------------------------------------------------------------
create table if not exists public.bmr_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  effective_from date not null,
  bmr            integer not null,
  created_at     timestamptz not null default now()
);
create unique index if not exists bmr_entries_user_day on public.bmr_entries (user_id, effective_from);

-- ----------------------------------------------------------------------------
-- weight_anchors: effective-dated "starting weight". Acts as a weigh-in. The
-- projected weight line re-baselines to this value on its effective date and
-- projects forward from cumulative net (3500 kcal per lb).
-- ----------------------------------------------------------------------------
create table if not exists public.weight_anchors (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  effective_from date not null,
  weight_lb      numeric not null,
  created_at     timestamptz not null default now()
);
create unique index if not exists weight_anchors_user_day on public.weight_anchors (user_id, effective_from);

-- ----------------------------------------------------------------------------
-- macro_entries: food intake. Calories are DERIVED (4/4/9), never stored.
-- ----------------------------------------------------------------------------
create table if not exists public.macro_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  date       date not null,
  meal_name  text,
  protein_g  numeric not null default 0,
  carbs_g    numeric not null default 0,
  fat_g      numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists macro_entries_user_idx on public.macro_entries (user_id, date);

-- ----------------------------------------------------------------------------
-- cardio_entries: cardio sessions. calories_burned feeds "calories out".
-- ----------------------------------------------------------------------------
create table if not exists public.cardio_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  date            date not null,
  minutes         integer not null default 0,
  calories_burned integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists cardio_entries_user_idx on public.cardio_entries (user_id, date);

-- ----------------------------------------------------------------------------
-- lifting_calorie_entries: the manual "weights" calorie burn used in the net.
-- ----------------------------------------------------------------------------
create table if not exists public.lifting_calorie_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  date            date not null,
  calories_burned integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists lifting_cal_user_idx on public.lifting_calorie_entries (user_id, date);

-- ----------------------------------------------------------------------------
-- lifting_exercises: structured exercise log. Not surfaced as analysis in v1,
-- but muscle_group/sets/reps are captured so a muscle-balance view can be
-- rebuilt purely from this data later.
-- ----------------------------------------------------------------------------
create table if not exists public.lifting_exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  date         date not null,
  name         text not null,
  muscle_group text not null check (muscle_group in (
    'chest','back','shoulders','biceps','triceps','forearms',
    'glutes','quadriceps','hamstrings','calves','core')),
  sets         integer not null default 0,
  reps         integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists lifting_ex_user_idx on public.lifting_exercises (user_id, date);

-- ----------------------------------------------------------------------------
-- Row Level Security: owner-only on every table.
-- ----------------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.bmr_entries             enable row level security;
alter table public.weight_anchors          enable row level security;
alter table public.macro_entries           enable row level security;
alter table public.cardio_entries          enable row level security;
alter table public.lifting_calorie_entries enable row level security;
alter table public.lifting_exercises       enable row level security;

-- profiles: keyed on id = auth.uid()
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
-- (insert handled by the trigger below, which runs as definer)

-- generic owner policies for the log tables (keyed on user_id)
do $$
declare t text;
begin
  foreach t in array array[
    'bmr_entries','weight_anchors','macro_entries','cardio_entries',
    'lifting_calorie_entries','lifting_exercises'
  ] loop
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id);', t||'_select_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id);', t||'_insert_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t||'_update_own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id);', t||'_delete_own', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user is created. Username comes
-- from the metadata we set at signup.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
