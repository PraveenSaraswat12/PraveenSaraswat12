import { createClient } from '@supabase/supabase-js';

/* ============================================================
   KITHRA — optional cloud backend (Supabase + Gemma)
   ------------------------------------------------------------
   Inert until the user connects their own free Supabase project
   (Privacy → "Cloud & account"). Config is stored in localStorage
   'kithra_cloud' = { SUPABASE_URL, SUPABASE_ANON_KEY }.
   The AI (Gemma) runs through a Supabase Edge Function so the
   Google AI key stays server-side. Everything here no-ops safely
   when unconfigured, so the app works fully offline/local-first.
   ============================================================ */
const CFG_KEY = 'kithra_cloud';

function getConfig() {
  try { if (window.KITHRA_CONFIG && window.KITHRA_CONFIG.SUPABASE_URL && window.KITHRA_CONFIG.SUPABASE_ANON_KEY) return window.KITHRA_CONFIG; } catch (e) {}
  try { const s = JSON.parse(localStorage.getItem(CFG_KEY)); if (s && s.SUPABASE_URL && s.SUPABASE_ANON_KEY) return s; } catch (e) {}
  return null;
}

// supabase-js is BUNDLED (not a runtime CDN import) so auth works even on
// networks that block third-party CDNs, and a blocked import can never leave
// the login button spinning forever.
let _client = null;
function getClient() {
  const cfg = getConfig();
  if (!cfg) return null;
  if (!_client) {
    _client = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
    });
  }
  return _client;
}

// Never let a stalled network leave the UI spinning — reject with a clear,
// user-facing message instead.
function withTimeout(promise, ms, message) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}
const NET_MSG = 'Couldn’t reach the account server — check your connection and try again.';

// ---- device-bound encryption (AES-GCM 256 via WebCrypto) ----
// Content synced to the cloud is encrypted on-device first; the key never
// leaves this device. (Honest scope: protects data at rest server-side; it is
// not multi-device E2EE — that needs key escrow/passphrases, a later step.)
let _key = null;
async function deviceKey() {
  if (_key) return _key;
  const b64ToBuf = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
  const bufToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  let raw = null;
  try { const s = localStorage.getItem('kithra_dk'); if (s) raw = b64ToBuf(s); } catch (e) {}
  if (!raw) {
    raw = crypto.getRandomValues(new Uint8Array(32));
    try { localStorage.setItem('kithra_dk', bufToB64(raw)); } catch (e) {}
  }
  _key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return _key;
}
async function encStr(plain) {
  if (plain == null || plain === '') return plain;
  try {
    const key = await deviceKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(plain)));
    const buf = new Uint8Array(iv.length + ct.byteLength); buf.set(iv); buf.set(new Uint8Array(ct), iv.length);
    return 'enc1:' + btoa(String.fromCharCode(...buf));
  } catch (e) { return plain; }
}
async function decStr(s) {
  if (typeof s !== 'string' || s.indexOf('enc1:') !== 0) return s;
  try {
    const buf = Uint8Array.from(atob(s.slice(5)), (c) => c.charCodeAt(0));
    const key = await deviceKey();
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
    return new TextDecoder().decode(pt);
  } catch (e) { return '[encrypted on another device]'; }
}

const Cloud = {
  configured: () => !!getConfig(),
  config: () => getConfig(),
  saveConfig(url, key) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify({ SUPABASE_URL: String(url).trim().replace(/\/$/, ''), SUPABASE_ANON_KEY: String(key).trim() })); } catch (e) {}
    _client = null;
  },
  clearConfig() { try { localStorage.removeItem(CFG_KEY); } catch (e) {} _client = null; },

  async getUser() { try { const c = await getClient(); if (!c) return null; const { data } = await c.auth.getUser(); return data?.user || null; } catch (e) { return null; } },
  async signUp(email, password) { const c = await getClient(); if (!c) throw new Error('Connect your cloud first'); const { data, error } = await withTimeout(c.auth.signUp({ email, password }), 20000, NET_MSG); if (error) throw error; return data; },
  async signIn(email, password) { const c = await getClient(); if (!c) throw new Error('Connect your cloud first'); const { data, error } = await withTimeout(c.auth.signInWithPassword({ email, password }), 20000, NET_MSG); if (error) throw error; return data; },
  async signOut() { const c = await getClient(); if (c) await c.auth.signOut(); },

  // ---- password reset: email a link, then set a new password on return ----
  async resetPassword(email, redirectTo) {
    const c = await getClient(); if (!c) throw new Error('Connect your cloud first');
    const { error } = await c.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: redirectTo || window.location.href });
    if (error) throw error; return true;
  },
  async updatePassword(newPassword) {
    const c = await getClient(); if (!c) throw new Error('Connect your cloud first');
    const { data, error } = await c.auth.updateUser({ password: newPassword });
    if (error) throw error; return data;
  },
  async onPasswordRecovery(cb) {
    const c = await getClient(); if (!c) return () => {};
    const { data } = c.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') { try { cb(); } catch (e) {} } });
    return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
  },
  // Fire on every auth session change (OAuth redirect sign-in, token refresh,
  // sign-out) so the app's login gate updates the moment the session lands —
  // even if the first check ran before the returned token was parsed.
  onAuthChange(cb) {
    try {
      const c = getClient(); if (!c) return () => {};
      const { data } = c.auth.onAuthStateChange((event, session) => { try { cb(event, session); } catch (e) {} });
      return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
    } catch (e) { return () => {}; }
  },

  // ---- Google sign-in (OAuth redirect) ----
  // Returns to the current URL; Supabase picks the session out of the hash on
  // return (detectSessionInUrl). Requires the Google provider + this redirect
  // URL to be enabled in Supabase → Authentication → Providers / URL config.
  async signInWithGoogle(redirectTo) {
    const c = await getClient(); if (!c) throw new Error('Connect your cloud first');
    // Return to the app's CLEAN base URL (origin + path, no #hash route) so the
    // session lands on a stable, allow-listable URL. This exact URL must be set
    // in Supabase → Authentication → URL Configuration (Site URL + Redirect URLs).
    const cleanUrl = window.location.origin + window.location.pathname;
    const { data, error } = await withTimeout(c.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo || cleanUrl, queryParams: { prompt: 'select_account' } },
    }), 20000, NET_MSG);
    if (error) throw error; return data;
  },

  // book sync (called from the app whenever the library changes, if signed in)
  // notes are encrypted on-device before upload
  async syncBooks(books) {
    try {
      const c = await getClient(); if (!c) return;
      const u = await Cloud.getUser(); if (!u) return;
      const rows = await Promise.all((books || []).map(async (b) => ({ id: b.id, user_id: u.id, title: b.title, author: b.author || null, type: b.type || 'book', notes: b.notes ? await encStr(b.notes) : null })));
      if (rows.length) await c.from('books').upsert(rows);
    } catch (e) {}
  },
  async fetchBooks() {
    try {
      const c = await getClient(); if (!c) return null; const u = await Cloud.getUser(); if (!u) return null;
      // Scope to this user EXPLICITLY (defense-in-depth) — never rely on RLS alone.
      const { data } = await c.from('books').select('*').eq('user_id', u.id).order('created_at', { ascending: false });
      return await Promise.all((data || []).map(async (b) => ({ ...b, notes: await decStr(b.notes) })));
    } catch (e) { return null; }
  },

  // consent ledger sync (audit trail; DPDP-style documentation)
  async syncConsents(consents) {
    try {
      const c = await getClient(); if (!c) return;
      const u = await Cloud.getUser(); if (!u) return;
      const rows = Object.entries(consents || {}).map(([purpose, v]) => ({ user_id: u.id, purpose, granted: !!v.granted, version: v.version || '1', at: new Date(v.at || Date.now()).toISOString() }));
      if (rows.length) await c.from('consents').upsert(rows, { onConflict: 'user_id,purpose' });
    } catch (e) {}
  },

  // save a recording's metadata + (encrypted) transcript to the user's account
  async saveRecording(rec) {
    try {
      const c = await getClient(); if (!c) return false;
      const u = await Cloud.getUser(); if (!u) return false;
      // insights are AI-derived from the transcript, so encrypt them on-device too
      const insights = rec.insights ? await encStr(JSON.stringify(rec.insights)) : null;
      await c.from('recordings').upsert({ id: rec.id, user_id: u.id, name: rec.name || null, duration: rec.durSec || null, source: rec.source || null, analysis: rec.analysis || null, transcript: rec.transcript ? await encStr(rec.transcript) : null, insights });
      return true;
    } catch (e) { return false; }
  },
  // fetch the user's saved recordings (decrypting transcripts) — cross-session memory
  async fetchRecordings() {
    try {
      const c = await getClient(); if (!c) return null;
      const u = await Cloud.getUser(); if (!u) return null;
      // Scope to this user EXPLICITLY (defense-in-depth) — never rely on RLS alone,
      // so a recording can never appear under another account even if the
      // database policy is missing/misconfigured.
      const { data } = await c.from('recordings').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(50);
      return await Promise.all((data || []).map(async (r) => {
        let insights = null;
        if (r.insights) { try { insights = JSON.parse(await decStr(r.insights)); } catch (e) { insights = null; } }
        return {
          id: r.id, name: r.name, durSec: r.duration, source: r.source || 'upload',
          analysis: r.analysis, transcript: await decStr(r.transcript), insights,
          ts: r.created_at ? new Date(r.created_at).getTime() : Date.now(), cloud: true,
        };
      }));
    } catch (e) { return null; }
  },
  async deleteRecording(id) {
    try { const c = await getClient(); if (!c) return false; const u = await Cloud.getUser(); if (!u) return false;
      await c.from('recordings').delete().eq('user_id', u.id).eq('id', id); return true; } catch (e) { return false; }
  },

  // hard-delete everything this user has in the cloud (right to erasure)
  async deleteAllCloud() {
    try {
      const c = await getClient(); if (!c) return false;
      const u = await Cloud.getUser(); if (!u) return false;
      await c.from('recordings').delete().eq('user_id', u.id);
      await c.from('books').delete().eq('user_id', u.id);
      await c.from('consents').delete().eq('user_id', u.id);
      return true;
    } catch (e) { return false; }
  },

  // AI via the Edge Function (keeps the Gemma/Google key server-side)
  async askAI(prompt, system) {
    const cfg = getConfig(); if (!cfg) throw new Error('Connect your cloud first');
    const c = await getClient();
    let token = cfg.SUPABASE_ANON_KEY;
    try { const { data } = await c.auth.getSession(); if (data?.session?.access_token) token = data.session.access_token; } catch (e) {}
    const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': cfg.SUPABASE_ANON_KEY },
      body: JSON.stringify({ prompt, system }),
    });
    if (!res.ok) throw new Error('AI request failed (' + res.status + ')');
    const j = await res.json();
    if (j.error) throw new Error(j.error);
    return j.text || '';
  },

  // accurate transcription via the Edge Function (Groq Whisper, Gemini fallback).
  // Returns { text, segments, engine } — segments (start/end/text) are only
  // present from the Groq engine, and power click-to-seek + follow-along
  // highlighting in the transcript UI.
  async transcribe(audioBase64, opts = {}) {
    const cfg = getConfig(); if (!cfg) throw new Error('Cloud not configured');
    const c = await getClient();
    let token = cfg.SUPABASE_ANON_KEY;
    try { const { data } = await c.auth.getSession(); if (data?.session?.access_token) token = data.session.access_token; } catch (e) {}
    const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': cfg.SUPABASE_ANON_KEY },
      body: JSON.stringify({ audio: audioBase64, mimeType: opts.mimeType || 'audio/wav', language: opts.language, context: opts.context }),
    });
    if (!res.ok) throw new Error('Transcription failed (' + res.status + ')');
    const j = await res.json();
    if (j.error) throw new Error(j.error);
    return { text: j.text || '', segments: Array.isArray(j.segments) ? j.segments : null, engine: j.engine || '' };
  },

  // ---- payments (Razorpay via the `payments` Edge Function) ----
  // The Razorpay secret stays server-side; the function holds the price table
  // (client can't tamper with amounts) and verifies the signature on return.
  async _payFetch(body) {
    const cfg = getConfig(); if (!cfg) throw new Error('Cloud not configured');
    const c = await getClient();
    let token = cfg.SUPABASE_ANON_KEY;
    try { const { data } = await c.auth.getSession(); if (data?.session?.access_token) token = data.session.access_token; } catch (e) {}
    const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': cfg.SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) throw new Error(j.error || ('Payment request failed (' + res.status + ')'));
    return j;
  },
  createOrder(plan, period, currency) { return Cloud._payFetch({ action: 'order', plan, period, currency }); },
  verifyPayment(payload) { return Cloud._payFetch({ action: 'verify', ...payload }); },
  async getSubscription() {
    try {
      const c = await getClient(); if (!c) return null; const u = await Cloud.getUser(); if (!u) return null;
      const { data } = await c.from('subscriptions').select('*').eq('user_id', u.id).maybeSingle();
      return data || null;
    } catch (e) { return null; }
  },
};

if (typeof window !== 'undefined') window.KithraCloud = Cloud;
export default Cloud;
