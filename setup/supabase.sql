-- ─────────────────────────────────────────────────────────────────────────────
-- Kithra Insight — encrypted cloud backup of workspaces.
-- Run ONCE in Supabase → SQL editor to enable "Back up to my cloud" in the
-- app's Settings. Idempotent (safe to re-run).
-- Payloads arrive client-side encrypted (AES-256-GCM) — the database only
-- ever stores ciphertext plus a name and row counts for listing.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.insight_workspaces (
  id text not null,                              -- client-generated workspace id
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Workspace',
  summary jsonb not null default '{}'::jsonb,    -- counts only, no row data
  payload jsonb not null,                        -- encrypted blob {v, iv, ct}
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.insight_workspaces enable row level security;

drop policy if exists "own workspaces: select" on public.insight_workspaces;
create policy "own workspaces: select"
  on public.insight_workspaces for select
  using (auth.uid() = user_id);

drop policy if exists "own workspaces: insert" on public.insight_workspaces;
create policy "own workspaces: insert"
  on public.insight_workspaces for insert
  with check (auth.uid() = user_id);

drop policy if exists "own workspaces: update" on public.insight_workspaces;
create policy "own workspaces: update"
  on public.insight_workspaces for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own workspaces: delete" on public.insight_workspaces;
create policy "own workspaces: delete"
  on public.insight_workspaces for delete
  using (auth.uid() = user_id);

create index if not exists insight_workspaces_user_updated
  on public.insight_workspaces (user_id, updated_at desc);
