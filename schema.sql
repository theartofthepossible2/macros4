-- Meal Log schema
-- Run this in the Supabase SQL editor on a fresh project, or via the CLI.

-- =====================================================
-- profiles: one row per authenticated user
-- =====================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  trainer_id uuid references public.profiles(id) on delete set null,
  is_trainer boolean not null default false,
  barcode_number text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- preferences: display + unit preferences per user
-- =====================================================
create type display_mode as enum ('calories_only', 'calories_protein', 'full_macros', 'macros_fiber');
create type unit_system as enum ('metric', 'imperial');

create table public.preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_mode display_mode not null default 'full_macros',
  units unit_system not null default 'metric',
  updated_at timestamptz not null default now()
);

-- =====================================================
-- meals: each parsed meal logged
-- =====================================================
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_at timestamptz not null default now(),
  description text,
  items jsonb not null,
  calories integer not null,
  protein_g integer not null,
  carbs_g integer not null,
  fat_g integer not null,
  fiber_g integer,
  flags text[] not null default '{}',
  notes text,
  source text not null default 'photo',
  edited boolean not null default false
);

create index meals_user_logged_idx on public.meals (user_id, logged_at desc);

-- =====================================================
-- updated_at trigger
-- =====================================================
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger preferences_touch before update on public.preferences
  for each row execute function public.touch_updated_at();

-- =====================================================
-- auto-create profile + preferences on signup
-- =====================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  insert into public.preferences (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- Row Level Security
-- =====================================================
alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.meals enable row level security;

-- profiles: users see their own; trainers see assigned clients'
create policy "profiles self read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles trainer read" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_trainer = true and p.id = trainer_id
    )
  );
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id);

-- preferences: only owner
create policy "preferences self all" on public.preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- meals: owner full access; trainers read-only on their clients
create policy "meals self all" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meals trainer read" on public.meals
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = user_id and p.trainer_id = auth.uid()
    )
  );
