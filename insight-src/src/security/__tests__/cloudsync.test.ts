// QA: encrypted cloud backup — fake Supabase, real crypto.
import { beforeEach, describe, expect, it } from 'vitest';
import type { Workspace } from '../../contracts/types';
import { __setSupabaseForTests } from '../../platform/cloud';
import {
  __resetCloudCacheForTests, cloudAvailable, cloudDeleteAll, cloudDeleteWorkspace,
  cloudListWorkspaces, cloudLoadWorkspace, cloudSaveWorkspace, getCloudSync, setCloudSync,
} from '../cloudsync';

function makeWorkspace(id: string, name: string): Workspace {
  return {
    id, name,
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
    sources: [{ id: 's1', name: 'secret.csv', kind: 'csv', addedAt: '', sizeBytes: 9, tableIds: ['t1'] }],
    tables: [{
      id: 't1', name: 'orders', sourceId: 's1',
      columns: ['city', 'amount'], rows: [['Pune', 100]], profiles: [], rowCount: 1,
    }],
    relations: [], dashboards: [], insights: [], chat: [], schemaVersion: 1,
  };
}

/** minimal in-memory Supabase double for the query chains cloudsync uses */
function fakeSupabase(userId: string | null, tableExists = true) {
  const rows = new Map<string, any>();
  const chain = (op: string) => {
    const state: any = { filters: {} as Record<string, unknown> };
    const api: any = {
      select() { return api; },
      order() {
        if (!tableExists) return { data: null, error: { message: 'relation does not exist' } };
        const data = [...rows.values()]
          .filter((r) => r.user_id === userId)
          .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
        return { data, error: null };
      },
      limit() {
        return tableExists ? { data: [], error: null } : { data: null, error: { message: 'relation does not exist' } };
      },
      eq(col: string, v: unknown) { state.filters[col] = v; return api; },
      maybeSingle() {
        const hit = [...rows.values()].find(
          (r) => (!state.filters.id || r.id === state.filters.id) && r.user_id === userId,
        );
        return { data: hit ?? null, error: null };
      },
      then(resolve: (v: any) => void) {
        // awaited bare chains (delete().eq()) resolve here
        if (op === 'delete') {
          for (const [k, r] of [...rows.entries()]) {
            const idMatch = !state.filters.id || r.id === state.filters.id;
            const userMatch = !state.filters.user_id || r.user_id === state.filters.user_id;
            if (idMatch && userMatch && r.user_id === userId) rows.delete(k);
          }
          resolve({ error: null });
        } else resolve({ data: null, error: null });
      },
    };
    return api;
  };
  return {
    __rows: rows,
    auth: {
      getSession: async () => ({ data: { session: userId ? { user: { id: userId }, access_token: 't' } : null } }),
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    },
    from(_table: string) {
      return {
        upsert: async (row: any) => {
          if (!tableExists) return { error: { message: 'relation does not exist' } };
          rows.set(`${row.user_id}:${row.id}`, { ...row });
          return { error: null };
        },
        select: (..._a: any[]) => chain('select'),
        delete: () => chain('delete'),
      };
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  __resetCloudCacheForTests();
});

describe('cloud sync', () => {
  it('sync flag defaults off and persists', () => {
    expect(getCloudSync()).toBe(false);
    setCloudSync(true);
    expect(getCloudSync()).toBe(true);
  });

  it('unavailable when signed out or table missing', async () => {
    __setSupabaseForTests(fakeSupabase(null));
    expect(await cloudAvailable()).toBe(false);
    __resetCloudCacheForTests();
    __setSupabaseForTests(fakeSupabase('u1', false));
    expect(await cloudAvailable()).toBe(false);
  });

  it('save → list → load roundtrip, payload encrypted, delete works', async () => {
    const fake = fakeSupabase('u1');
    __setSupabaseForTests(fake);
    expect(await cloudAvailable()).toBe(true);

    await cloudSaveWorkspace(makeWorkspace('ws1', 'Receivables'));
    await cloudSaveWorkspace(makeWorkspace('ws2', 'Inventory'));

    // ciphertext only in the stored payload
    const stored = JSON.stringify([...fake.__rows.values()].map((r) => r.payload));
    expect(stored).not.toContain('Pune');
    expect(stored).not.toContain('secret.csv');

    const list = await cloudListWorkspaces();
    expect(list.map((w) => w.id).sort()).toEqual(['ws1', 'ws2']);
    expect(list[0].rowCount).toBe(1);

    const back = await cloudLoadWorkspace('ws1');
    expect(back?.name).toBe('Receivables');
    expect(back?.tables[0].rows[0][0]).toBe('Pune'); // decrypted with account key

    await cloudDeleteWorkspace('ws1');
    expect((await cloudListWorkspaces()).map((w) => w.id)).toEqual(['ws2']);

    await cloudDeleteAll();
    expect(await cloudListWorkspaces()).toEqual([]);
  });

  it('another account cannot open the ciphertext', async () => {
    const fake = fakeSupabase('u1');
    __setSupabaseForTests(fake);
    await cloudSaveWorkspace(makeWorkspace('ws9', 'Mine'));
    // simulate the same row surfacing under a different account key
    const row = [...fake.__rows.values()][0];
    const other = fakeSupabase('u2');
    (other.__rows as Map<string, any>).set(`u2:ws9`, { ...row, user_id: 'u2' });
    __resetCloudCacheForTests();
    __setSupabaseForTests(other);
    await expect(cloudLoadWorkspace('ws9')).rejects.toThrow(/account/i);
  });
});
