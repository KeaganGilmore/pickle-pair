-- PicklePair — Supabase schema
-- Run this in the Supabase SQL editor once per project.
-- Tokens (not auth) are the primary authorization boundary for a tournament.
-- Anonymous auth is used only to get a stable uid for RLS quota isolation.

-- =========================================================================
-- Extensions
-- =========================================================================
create extension if not exists "pgcrypto";

-- =========================================================================
-- Tables
-- =========================================================================

create table if not exists public.tournaments (
  id text primary key,
  token text not null unique,        -- public spectator/read-only token
  edit_token text not null unique,   -- organizer edit token
  name text not null,
  mode text not null check (mode in ('singles','doubles')),
  format text not null check (format in ('round_robin','single_elim','americano','king_of_court')),
  partner_mode text check (partner_mode in ('random','fixed','rotating')),
  mixed boolean not null default false,
  round_size_mode text not null default 'full' check (round_size_mode in ('full','by_courts')),
  courts int not null default 2 check (courts > 0),
  points_to_win int not null default 11 check (points_to_win > 0),
  win_by_two boolean not null default true,
  time_cap_minutes int,
  status text not null default 'setup' check (status in ('setup','live','paused','done')),
  current_round int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tournaments_token on public.tournaments(token);
create index if not exists idx_tournaments_edit_token on public.tournaments(edit_token);

-- Migration-safe: add columns for existing deployments.
alter table public.tournaments add column if not exists round_size_mode text not null default 'full';
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tournaments_round_size_mode_check' and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_round_size_mode_check
      check (round_size_mode in ('full','by_courts'));
  end if;
end$$;

create table if not exists public.players (
  id text primary key,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  name text not null,
  gender text not null default 'Unspecified' check (gender in ('M','F','Other','Unspecified')),
  skill numeric(3,1),
  withdrawn boolean not null default false,
  withdrawn_at timestamptz,
  fixed_partner_id text,
  seed int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_players_tournament on public.players(tournament_id);

create table if not exists public.matches (
  id text primary key,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  round int not null,
  court int,
  team_a jsonb not null default '[]'::jsonb,
  team_b jsonb not null default '[]'::jsonb,
  score_a int not null default 0,
  score_b int not null default 0,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','void','bye','forfeit')),
  bracket_slot text,
  winner_feeds_match text,
  loser_feeds_match text,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_matches_tournament on public.matches(tournament_id);
create index if not exists idx_matches_round on public.matches(tournament_id, round);

create table if not exists public.audit_log (
  id text primary key,
  tournament_id text not null references public.tournaments(id) on delete cascade,
  action text not null,
  target_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_tournament on public.audit_log(tournament_id, created_at desc);

-- =========================================================================
-- Row-level security
-- =========================================================================
-- Authorization model: token-based.
-- Spec constraint: RLS needs a request-side claim to decide access, but the
-- app is purely token-authenticated via the URL. We open reads to any authed
-- user (including anonymous), and writes are open to any authed user — the
-- client only writes rows whose parent tournament it has the edit_token for.
-- For stricter enforcement, add a header-claim gate via Supabase edge
-- functions; this baseline is the pragmatic default for the courtside use-case.

alter table public.tournaments enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "tournaments read" on public.tournaments;
create policy "tournaments read" on public.tournaments
  for select using (true);

drop policy if exists "tournaments write" on public.tournaments;
create policy "tournaments write" on public.tournaments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "players read" on public.players;
create policy "players read" on public.players
  for select using (true);

drop policy if exists "players write" on public.players;
create policy "players write" on public.players
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "matches read" on public.matches;
create policy "matches read" on public.matches
  for select using (true);

drop policy if exists "matches write" on public.matches;
create policy "matches write" on public.matches
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "audit read" on public.audit_log;
create policy "audit read" on public.audit_log
  for select using (true);

drop policy if exists "audit write" on public.audit_log;
create policy "audit write" on public.audit_log
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =========================================================================
-- Triggers: keep updated_at fresh
-- =========================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_tournaments on public.tournaments;
create trigger touch_tournaments before update on public.tournaments
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_players on public.players;
create trigger touch_players before update on public.players
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_matches on public.matches;
create trigger touch_matches before update on public.matches
  for each row execute function public.touch_updated_at();
