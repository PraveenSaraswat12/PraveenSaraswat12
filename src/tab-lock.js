/* ============================================================
   KITHRA — single-tab live-capture lock
   ------------------------------------------------------------
   Live capture owns the microphone, a continuous recognizer, and
   (in conversation mode) AI calls. Running it in two tabs at once
   means duplicated transcripts, fighting over the mic, and double
   cost — so only ONE tab may hold live capture at a time.

   The lock lives in localStorage (so it survives a tab crash via a
   heartbeat + TTL) and changes are broadcast instantly to other
   tabs. Everything degrades gracefully if these APIs are missing.
   ============================================================ */
const KEY = 'kithra_live_lock';
const CH = 'kithra-live';
const HEARTBEAT = 2500;   // ms between heartbeats while we own the lock
const TTL = 7000;         // ms a lock stays "alive" since its last heartbeat

const TAB_ID = (() => {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return 't-' + Date.now() + '-' + Math.random().toString(36).slice(2);
})();

const hasWin = typeof window !== 'undefined';
const ls = () => { try { return hasWin ? window.localStorage : null; } catch (e) { return null; } };

let _bc;
function channel() {
  if (_bc !== undefined) return _bc;
  try { _bc = (hasWin && 'BroadcastChannel' in window) ? new BroadcastChannel(CH) : null; }
  catch (e) { _bc = null; }
  return _bc;
}

function readLock() {
  const s = ls(); if (!s) return null;
  try { const v = JSON.parse(s.getItem(KEY)); return (v && v.id) ? v : null; } catch (e) { return null; }
}
function writeLock(v) { const s = ls(); if (s) { try { s.setItem(KEY, JSON.stringify(v)); } catch (e) {} } }
function clearLock() { const s = ls(); if (s) { try { s.removeItem(KEY); } catch (e) {} } }

const alive = (lock) => !!lock && (Date.now() - (lock.ts || 0) < TTL);

let _hb = null;
function startHeartbeat() {
  stopHeartbeat();
  _hb = setInterval(() => {
    const lock = readLock();
    if (lock && lock.id === TAB_ID) writeLock({ ...lock, ts: Date.now() });
    else stopHeartbeat(); // we lost ownership (taken over) — stop beating
  }, HEARTBEAT);
}
function stopHeartbeat() { if (_hb) { clearInterval(_hb); _hb = null; } }

function broadcast(type) {
  const bc = channel();
  try { bc && bc.postMessage({ type, id: TAB_ID, t: Date.now() }); } catch (e) {}
}

export function state() {
  const lock = readLock();
  if (!alive(lock)) return 'free';
  return lock.id === TAB_ID ? 'mine' : 'theirs';
}
export function busyElsewhere() { return state() === 'theirs'; }
export function owned() { return state() === 'mine'; }

// Try to take the lock. Returns false only if another live tab already holds it.
export function claim(meta = {}) {
  if (busyElsewhere()) return false;
  writeLock({ id: TAB_ID, ts: Date.now(), mode: meta.mode || null });
  startHeartbeat();
  broadcast('claimed');
  return true;
}
// Force the lock to this tab (an explicit user "take over here").
export function takeover(meta = {}) {
  writeLock({ id: TAB_ID, ts: Date.now(), mode: meta.mode || null });
  startHeartbeat();
  broadcast('takeover');
  return true;
}
export function release() {
  const lock = readLock();
  if (lock && lock.id === TAB_ID) { clearLock(); broadcast('released'); }
  stopHeartbeat();
}

// Subscribe to lock changes; cb receives the current state ('free'|'mine'|'theirs').
export function subscribe(cb) {
  if (!hasWin) return () => {};
  const fire = () => { try { cb(state()); } catch (e) {} };
  const onMsg = () => fire();
  const onStorage = (e) => { if (!e || e.key === KEY || e.key === null) fire(); };
  const bc = channel();
  try { bc && bc.addEventListener('message', onMsg); } catch (e) {}
  window.addEventListener('storage', onStorage);
  // watchdog: catches a foreign lock going stale (its tab crashed) with no event
  const watch = setInterval(fire, TTL);
  return () => {
    clearInterval(watch);
    try { bc && bc.removeEventListener('message', onMsg); } catch (e) {}
    window.removeEventListener('storage', onStorage);
  };
}

// exposed for tests (simulate other tabs by writing a different id)
export const _internals = { TAB_ID, KEY, TTL, HEARTBEAT, readLock, writeLock, clearLock, alive };
