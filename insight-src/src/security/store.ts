// Workspace persistence: IndexedDB, payloads always encrypted at rest.
import type { Workspace, WorkspaceSummary } from '../contracts/types';
import { decryptJSON, encryptJSON, openWithPassphrase, sealWithPassphrase, type SealedBox } from './vault';

const DB_NAME = 'kithra-insight';
const STORE = 'workspaces';

interface StoredRecord {
  id: string;
  name: string;
  updatedAt: string;
  summary: { sourceCount: number; tableCount: number; rowCount: number };
  payload: SealedBox;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open local storage'));
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => { db.close(); resolve(req.result); };
        t.onerror = () => { db.close(); reject(t.error ?? new Error('Local storage failed')); };
        t.onabort = () => {
          db.close();
          const e = t.error;
          reject(e && e.name === 'QuotaExceededError'
            ? new Error('Local storage is full — export a workspace as backup, then delete it.')
            : e ?? new Error('Local storage aborted'));
        };
      }),
  );
}

export async function saveWorkspace(ws: Workspace): Promise<void> {
  const rec: StoredRecord = {
    id: ws.id,
    name: ws.name,
    updatedAt: new Date().toISOString(),
    summary: {
      sourceCount: ws.sources.length,
      tableCount: ws.tables.length,
      rowCount: ws.tables.reduce((a, t) => a + t.rowCount, 0),
    },
    payload: await encryptJSON({ ...ws, updatedAt: new Date().toISOString() }),
  };
  await tx('readwrite', (s) => s.put(rec));
}

export async function loadWorkspace(id: string): Promise<Workspace | null> {
  const rec = (await tx('readonly', (s) => s.get(id))) as StoredRecord | undefined;
  if (!rec) return null;
  return decryptJSON<Workspace>(rec.payload);
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const all = (await tx('readonly', (s) => s.getAll())) as StoredRecord[];
  return all
    .map((r) => ({
      id: r.id, name: r.name, updatedAt: r.updatedAt,
      sourceCount: r.summary.sourceCount,
      tableCount: r.summary.tableCount,
      rowCount: r.summary.rowCount,
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function deleteWorkspace(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function exportWorkspace(ws: Workspace, passphrase: string): Promise<Blob> {
  return sealWithPassphrase(ws, passphrase);
}

export async function importWorkspace(file: File, passphrase: string): Promise<Workspace> {
  const ws = await openWithPassphrase<Workspace>(file, passphrase);
  if (!ws || ws.schemaVersion !== 1 || !Array.isArray(ws.tables)) {
    throw new Error('Backup contents are not a valid workspace.');
  }
  return { ...ws, updatedAt: new Date().toISOString() };
}

export function deleteDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
