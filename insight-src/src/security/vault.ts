// Encryption at rest: AES-256-GCM with a per-device key, PBKDF2 for backups.
import { readFileText } from '../engine/io/read';

const DK_KEY = 'kithra_insight_dk';

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let deviceKeyPromise: Promise<CryptoKey> | null = null;

function getDeviceKey(): Promise<CryptoKey> {
  if (!deviceKeyPromise) {
    deviceKeyPromise = (async () => {
      let raw: Uint8Array;
      const stored = localStorage.getItem(DK_KEY);
      if (stored) {
        raw = unb64(stored);
      } else {
        raw = crypto.getRandomValues(new Uint8Array(32));
        localStorage.setItem(DK_KEY, b64(raw));
      }
      return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
    })();
  }
  return deviceKeyPromise;
}

export interface SealedBox { v: 1; iv: string; ct: string; }

export async function encryptJSON(obj: unknown): Promise<SealedBox> {
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource);
  return { v: 1, iv: b64(iv), ct: b64(ct) };
}

export async function decryptJSON<T = unknown>(box: SealedBox): Promise<T> {
  try {
    const key = await getDeviceKey();
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(box.iv) as BufferSource }, key, unb64(box.ct) as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  } catch {
    throw new Error('Could not decrypt — this data may belong to another device or browser profile.');
  }
}

// ── passphrase-protected portable backups ────────────────────────────────────

const MAGIC = 'KITHRA-INSIGHT-BACKUP v1';

async function passKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase) as BufferSource, 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 250000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function sealWithPassphrase(obj: unknown, passphrase: string): Promise<Blob> {
  if (!passphrase || passphrase.length < 6) throw new Error('Use a passphrase of at least 6 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource }, key,
    new TextEncoder().encode(JSON.stringify(obj)) as BufferSource,
  );
  const payload = JSON.stringify({ salt: b64(salt), iv: b64(iv), ct: b64(ct) });
  return new Blob([`${MAGIC}\n${payload}`], { type: 'application/octet-stream' });
}

export async function openWithPassphrase<T = unknown>(file: File | Blob, passphrase: string): Promise<T> {
  const text = await readFileText(file);
  const nl = text.indexOf('\n');
  if (nl < 0 || text.slice(0, nl).trim() !== MAGIC) {
    throw new Error('This is not a Kithra Insight backup file.');
  }
  let parsed: { salt: string; iv: string; ct: string };
  try { parsed = JSON.parse(text.slice(nl + 1)); } catch {
    throw new Error('Backup file is damaged.');
  }
  try {
    const key = await passKey(passphrase, unb64(parsed.salt));
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(parsed.iv) as BufferSource }, key, unb64(parsed.ct) as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  } catch {
    throw new Error('Wrong passphrase for this backup.');
  }
}

// ── account-derived key for cloud sync ──────────────────────────────────────
// Lets any of the user's signed-in devices open their cloud copies. This is
// at-rest protection tied to the account — NOT zero-knowledge (documented in
// SECURITY.md; a passphrase mode is on the roadmap).

const SYNC_SALT = new TextEncoder().encode('kithra-insight-sync-v1');

export async function getSyncKey(userId: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(`ki:${userId}`) as BufferSource, 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SYNC_SALT as BufferSource, iterations: 100000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function encryptJSONWithKey(key: CryptoKey, obj: unknown): Promise<SealedBox> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource }, key,
    new TextEncoder().encode(JSON.stringify(obj)) as BufferSource,
  );
  return { v: 1, iv: b64(iv), ct: b64(ct) };
}

export async function decryptJSONWithKey<T = unknown>(key: CryptoKey, box: SealedBox): Promise<T> {
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(box.iv) as BufferSource }, key, unb64(box.ct) as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  } catch {
    throw new Error('Could not open this cloud copy with your account.');
  }
}

/** test hook: reset cached key (e.g. after erase) */
export function __resetVaultForTests() { deviceKeyPromise = null; }
