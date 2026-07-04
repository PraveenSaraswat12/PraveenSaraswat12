-- ─────────────────────────────────────────────────────────────────────────────
-- Kithra Insight — OPTIONAL encrypted cloud backup table.
-- NOT yet used by the app. Run this in Supabase → SQL editor when you want
-- to enable cross-device workspace sync in a future app update.
-- Payloads stay client-side encrypted (AES-256-GCM) — the server only ever
-- sees ciphertext.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.insight_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Workspace',
  summary jsonb not null default '{}'::jsonb,   -- counts only, no row data
  payload jsonb not null,                       -- client-side-encrypted blob {v, iv, ct}
  updated_at timestamptz not null default now()
);

alter table public.insight_workspaces enable row level security;

create policy "own workspaces: select"
  on public.insight_workspaces for select
  using (auth.uid() = user_id);

create policy "own workspaces: insert"
  on public.insight_workspaces for insert
  with check (auth.uid() = user_id);

create policy "own workspaces: update"
  on public.insight_workspaces for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own workspaces: delete"
  on public.insight_workspaces for delete
  using (auth.uid() = user_id);

create index if not exists insight_workspaces_user_updated
  on public.insight_workspaces (user_id, updated_at desc);
