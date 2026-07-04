// QA: vault crypto, encrypted persistence, backups, guest auth, erase.
import { beforeEach, describe, expect, it } from 'vitest';
import type { Workspace } from '../../contracts/types';
import { decryptJSON, encryptJSON, openWithPassphrase, sealWithPassphrase } from '../vault';
import {
  deleteDatabase, deleteWorkspace, exportWorkspace, importWorkspace,
  listWorkspaces, loadWorkspace, saveWorkspace,
} from '../store';
import { security } from '../index';
import { normalizePhone } from '../auth';
import { readFileText } from '../../engine/io/read';

function makeWorkspace(id: string, name = 'Test WS'): Workspace {
  return {
    id, name,
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
    sources: [{ id: 's1', name: 'secret-orders.csv', kind: 'csv', addedAt: '', sizeBytes: 10, tableIds: ['t1'] }],
    tables: [{
      id: 't1', name: 'orders', sourceId: 's1',
      columns: ['city', 'amount'],
      rows: [['Pune ₹★', 100], ['Goa', 200]],
      profiles: [], rowCount: 2,
    }],
    relations: [], dashboards: [], insights: [], chat: [],
    schemaVersion: 1,
  };
}

beforeEach(async () => {
  await deleteDatabase();
  localStorage.clear();
});

describe('vault', () => {
  it('roundtrips unicode JSON', async () => {
    const box = await encryptJSON({ msg: 'नमस्ते ₹ ★', n: 42 });
    expect(box.v).toBe(1);
    const back = await decryptJSON<{ msg: string; n: number }>(box);
    expect(back.msg).toBe('नमस्ते ₹ ★');
    expect(back.n).toBe(42);
  });
  it('detects tampering', async () => {
    const box = await encryptJSON({ a: 1 });
    const flipped = { ...box, ct: box.ct.slice(0, -2) + (box.ct.endsWith('A') ? 'BB' : 'AA') };
    await expect(decryptJSON(flipped)).rejects.toThrow(/decrypt/i);
  });
  it('uses a fresh iv per encryption', async () => {
    const a = await encryptJSON({ x: 1 });
    const b = await encryptJSON({ x: 1 });
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });
});

describe('encrypted store', () => {
  it('saves, lists, loads, deletes', async () => {
    await saveWorkspace(makeWorkspace('ws1', 'Receivables'));
    await saveWorkspace(makeWorkspace('ws2', 'Inventory'));
    const list = await listWorkspaces();
    expect(list).toHaveLength(2);
    expect(list[0].rowCount).toBe(2);
    const back = await loadWorkspace('ws1');
    expect(back?.name).toBe('Receivables');
    expect(back?.tables[0].rows[0][0]).toBe('Pune ₹★');
    await deleteWorkspace('ws1');
    expect(await listWorkspaces()).toHaveLength(1);
    expect(await loadWorkspace('ws1')).toBeNull();
  });

  it('never stores raw data in plaintext', async () => {
    await saveWorkspace(makeWorkspace('ws1'));
    // read the raw IDB record and ensure the sentinel value is not visible
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('kithra-insight', 1);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const rec = await new Promise<any>((res, rej) => {
      const t = db.transaction('workspaces', 'readonly');
      const rq = t.objectStore('workspaces').get('ws1');
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
    db.close();
    const raw = JSON.stringify(rec);
    expect(raw).not.toContain('Pune');
    expect(raw).not.toContain('secret-orders');
    expect(rec.name).toBe('Test WS'); // metadata stays readable for listing
  });

  it('export/import roundtrip with passphrase, wrong passphrase fails', async () => {
    const ws = makeWorkspace('ws9', 'Portable');
    const blob = await exportWorkspace(ws, 'correct-horse');
    const text = await readFileText(blob);
    expect(text.startsWith('KITHRA-INSIGHT-BACKUP v1')).toBe(true);
    expect(text).not.toContain('Pune');
    const file = new File([blob], 'p.kithra');
    const back = await importWorkspace(file, 'correct-horse');
    expect(back.name).toBe('Portable');
    await expect(importWorkspace(file, 'wrong-pass')).rejects.toThrow(/passphrase/i);
    await expect(openWithPassphrase(new File(['garbage'], 'x'), 'p')).rejects.toThrow(/not a kithra/i);
    // seal validation
    await expect(sealWithPassphrase({}, 'short')).rejects.toThrow(/6 characters/);
  });
});

describe('auth (guest + phone normalization)', () => {
  it('guest lifecycle works fully offline', async () => {
    const u = await security.continueAsGuest('Praveen');
    expect(u.provider).toBe('guest');
    expect(security.currentUser()?.name).toBe('Praveen');
    const restored = await security.init();
    expect(restored?.provider).toBe('guest');
    await security.signOut();
    expect(security.currentUser()).toBeNull();
  });
  it('normalizes phone numbers', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
    expect(normalizePhone('+1 415 555 2671')).toBe('+14155552671');
    expect(normalizePhone('91 98765 43210')).toBe('+919876543210');
    expect(() => normalizePhone('12345')).toThrow(/valid phone/i);
  });
  it('auth change listeners fire', async () => {
    const seen: (string | null)[] = [];
    const off = security.onAuthChange((u) => seen.push(u?.provider ?? null));
    await security.continueAsGuest();
    await security.signOut();
    off();
    expect(seen).toEqual(['guest', null]);
  });
});

describe('erase all', () => {
  it('wipes Insight data but spares root-Kithra keys', async () => {
    await saveWorkspace(makeWorkspace('wsX'));
    await security.continueAsGuest();
    security.setCloudConsent(true);
    localStorage.setItem('kithra_dk', 'ROOT-APP-KEY'); // root Kithra app's key
    localStorage.setItem('unrelated', 'keep-me');
    await security.eraseAllLocalData();
    expect(await listWorkspaces()).toHaveLength(0);
    expect(security.getCloudConsent()).toBe(false);
    expect(security.currentUser()).toBeNull();
    expect(localStorage.getItem('kithra_dk')).toBe('ROOT-APP-KEY');
    expect(localStorage.getItem('unrelated')).toBe('keep-me');
  });
});

describe('consent', () => {
  it('defaults off and persists', () => {
    expect(security.getCloudConsent()).toBe(false);
    security.setCloudConsent(true);
    expect(security.getCloudConsent()).toBe(true);
  });
});
