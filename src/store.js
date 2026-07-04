/* ============================================================
   KITHRA — durable on-device recording store (IndexedDB)
   ------------------------------------------------------------
   The device is the source of truth for recordings. We keep each
   clip's audio Blob + metadata here so nothing is lost on reload,
   sign-out/sign-in, or a cloud/table outage. Cloud sync (cloud.js)
   layers on top for cross-device. Every call no-ops safely if
   IndexedDB is unavailable, so the app never breaks because of it.

   Each record: { id, owner, blob, savedAt, ...clipMetadata }
   where clipMetadata = { name, durSec, peaks, source, analysis,
   transcript, insights, ts }. The ephemeral object URL is NOT
   stored — a fresh one is minted from the blob on read.
   ============================================================ */
const DB_NAME = 'kithra';
const STORE = 'clips';
const VERSION = 1;

let _db = null;
let _opening = null;

export function hasIDB() {
  try { return typeof indexedDB !== 'undefined' && !!indexedDB; } catch (e) { return false; }
}

function openDB() {
  if (_db) return Promise.resolve(_db);
  if (_opening) return _opening;
  _opening = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB_NAME, VERSION); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('owner', 'owner', { unique: false });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
  return _opening;
}

function store(mode) { return openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE)); }
const done = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

// Strict per-account scoping: a clip belongs to exactly ONE owner. We do NOT
// surface 'local'/unowned clips to a signed-in account — that cross-account
// "adopt on read" leaked recordings between accounts sharing a browser. Legacy
// local clips are claimed explicitly via adoptLocal() on sign-in instead.
const mineFor = (owner) => (r) => r && r.owner === owner;

// Save a clip's metadata + audio blob (strips the ephemeral object URL).
export async function putClip(clip, blob, owner) {
  if (!hasIDB() || !clip || !clip.id) return false;
  try {
    const { url, hasAudio, ...meta } = clip;
    const rec = { ...meta, owner: owner || 'local', blob: blob || null, savedAt: Date.now() };
    const os = await store('readwrite');
    await done(os.put(rec));
    return true;
  } catch (e) { return false; }
}

// Merge a metadata patch into an existing clip, keeping its stored audio blob.
export async function patchClip(id, patch) {
  if (!hasIDB() || !id || !patch) return false;
  try {
    const os = await store('readwrite');
    const cur = await done(os.get(id));
    if (!cur) return false;
    const { url, hasAudio, ...clean } = patch;
    await done(os.put({ ...cur, ...clean, id, savedAt: Date.now() }));
    return true;
  } catch (e) { return false; }
}

export async function deleteClip(id) {
  if (!hasIDB() || !id) return false;
  try { const os = await store('readwrite'); await done(os.delete(id)); return true; } catch (e) { return false; }
}

// All clips for an owner (newest first), each rehydrated with a fresh object URL
// for its stored audio so it's immediately playable.
export async function getClips(owner) {
  if (!hasIDB()) return [];
  try {
    const os = await store('readonly');
    const all = await done(os.getAll());
    return (all || [])
      .filter(mineFor(owner))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map((r) => {
        const { blob, owner: _o, savedAt, ...meta } = r;
        let url = null;
        if (blob) { try { url = URL.createObjectURL(blob); } catch (e) {} }
        return { ...meta, url, hasAudio: !!blob };
      });
  } catch (e) { return []; }
}

// Keep only the newest `keep` clips for an owner, pruning old audio to bound storage.
export async function pruneClips(owner, keep = 50) {
  if (!hasIDB()) return;
  try {
    const os = await store('readwrite');
    const all = await done(os.getAll());
    const mine = (all || []).filter(mineFor(owner)).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    for (const r of mine.slice(keep)) { try { await done(os.delete(r.id)); } catch (e) {} }
  } catch (e) {}
}

// One-time migration: claim any legacy unowned/'local' clips on this device to
// `owner`. New clips are always saved with a real owner, so after the first
// post-update sign-in this finds nothing. Returns how many were claimed.
export async function adoptLocal(owner) {
  if (!hasIDB() || !owner || owner === 'local') return 0;
  try {
    const os = await store('readwrite');
    const all = await done(os.getAll());
    let n = 0;
    for (const r of (all || [])) {
      if (r && (r.owner === 'local' || !r.owner)) { await done(os.put({ ...r, owner, savedAt: Date.now() })); n++; }
    }
    return n;
  } catch (e) { return 0; }
}

// expose for debugging + e2e (same API as the named exports above)
if (typeof window !== 'undefined') {
  window.KithraClipStore = { hasIDB, putClip, patchClip, deleteClip, getClips, pruneClips, adoptLocal };
}
