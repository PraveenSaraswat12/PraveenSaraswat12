-- ============================================================
-- Kithra — Supabase / Postgres schema
-- Run this in your Supabase project: SQL Editor → paste → Run.
-- ============================================================

-- Books library (the knowledge that grounds insights)
create table if not exists public.books (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  author     text,
  type       text default 'book',
  notes      text,
  created_at timestamptz default now()
);
alter table public.books enable row level security;
drop policy if exists "own books" on public.books;
create policy "own books" on public.books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Recordings + their analysis/transcript
create table if not exists public.recordings (
  id         text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text,
  duration   real,
  source     text,
  analysis   jsonb,
  transcript text,
  created_at timestamptz default now()
);
alter table public.recordings enable row level security;
drop policy if exists "own recordings" on public.recordings;
create policy "own recordings" on public.recordings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Consent ledger (DPDP-style audit trail: purpose, version, timestamp)
create table if not exists public.consents (
  user_id    uuid not null references auth.users(id) on delete cascade,
  purpose    text not null,
  granted    boolean not null default false,
  version    text,
  at         timestamptz default now(),
  primary key (user_id, purpose)
);
alter table public.consents enable row level security;
drop policy if exists "own consents" on public.consents;
create policy "own consents" on public.consents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private storage bucket for audio files + book covers.
insert into storage.buckets (id, name, public)
  values ('audio', 'audio', false)
  on conflict (id) do nothing;

drop policy if exists "own audio read"  on storage.objects;
drop policy if exists "own audio write" on storage.objects;
create policy "own audio read" on storage.objects
  for select using (bucket_id = 'audio' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own audio write" on storage.objects
  for insert with check (bucket_id = 'audio' and auth.uid()::text = (storage.foldername(name))[1]);
