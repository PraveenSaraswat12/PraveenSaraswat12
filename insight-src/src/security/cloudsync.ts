// Encrypted cloud backup of workspaces (Supabase table insight_workspaces).
// Payloads are AES-256-GCM sealed with an account-derived key BEFORE upload;
// row-level security limits every row to its owner. Fully optional: the app
// works local-only when signed out, offline, or before setup/supabase.sql
// has been run.
import type { Workspace, WorkspaceSummary } from '../contracts/types';
import { getSupabase } from '../platform/cloud';
import { decryptJSONWithKey, encryptJSONWithKey, getSyncKey, type SealedBox } from './vault';

const TABLE = 'insight_workspaces';
const SYNC_FLAG = 'ki_cloud_sync';

export function getCloudSync(): boolean {
  try { return localStorage.getItem(SYNC_FLAG) === '1'; } catch { return false; }
}

export function setCloudSync(v: boolean) {
  try { localStorage.setItem(SYNC_FLAG, v ? '1' : '0'); } catch { /* private mode */ }
}

async function session(): Promise<{ sb: any; userId: string } | null> {
  try {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    const userId = data?.session?.user?.id;
    return userId ? { sb, userId } : null;
  } catch {
    return null;
  }
}

let availableCache: boolean | null = null;

/** signed in AND the table exists (setup/supabase.sql has been run) */
export async function cloudAvailable(): Promise<boolean> {
  const s = await session();
  if (!s) return false;
  if (availableCache !== null) return availableCache;
  try {
    const { error } = await s.sb.from(TABLE).select('id').limit(1);
    availableCache = !error;
  } catch {
    availableCache = false;
  }
  return availableCache;
}

export function __resetCloudCacheForTests() { availableCache = null; }

export async function cloudSaveWorkspace(ws: Workspace): Promise<void> {
  const s = await session();
  if (!s) throw new Error('Sign in to back up to your cloud');
  const key = await getSyncKey(s.userId);
  const payload = await encryptJSONWithKey(key, ws);
  const row = {
    id: ws.id,
    user_id: s.userId,
    name: ws.name,
    summary: {
      sourceCount: ws.sources.length,
      tableCount: ws.tables.length,
      rowCount: ws.tables.reduce((a, t) => a + t.rowCount, 0),
    },
    payload,
    updated_at: new Date().toISOString(),
  };
  const { error } = await s.sb.from(TABLE).upsert(row, { onConflict: 'user_id,id' });
  if (error) throw new Error(error.message || 'Cloud backup failed');
}

export async function cloudListWorkspaces(): Promise<WorkspaceSummary[]> {
  const s = await session();
  if (!s) return [];
  const { data, error } = await s.sb
    .from(TABLE)
    .select('id,name,summary,updated_at')
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    id: r.id,
    name: r.name ?? 'Workspace',
    updatedAt: r.updated_at ?? new Date().toISOString(),
    sourceCount: r.summary?.sourceCount ?? 0,
    tableCount: r.summary?.tableCount ?? 0,
    rowCount: r.summary?.rowCount ?? 0,
  }));
}

export async function cloudLoadWorkspace(id: string): Promise<Workspace | null> {
  const s = await session();
  if (!s) return null;
  const { data, error } = await s.sb
    .from(TABLE)
    .select('payload')
    .eq('id', id)
    .maybeSingle();
  if (error || !data?.payload) return null;
  const key = await getSyncKey(s.userId);
  return decryptJSONWithKey<Workspace>(key, data.payload as SealedBox);
}

export async function cloudDeleteWorkspace(id: string): Promise<void> {
  const s = await session();
  if (!s) return;
  await s.sb.from(TABLE).delete().eq('id', id);
}

export async function cloudDeleteAll(): Promise<void> {
  const s = await session();
  if (!s) return;
  await s.sb.from(TABLE).delete().eq('user_id', s.userId);
}
