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

let _client = null, _clientPromise = null;
async function getClient() {
  const cfg = getConfig();
  if (!cfg) return null;
  if (_client) return _client;
  if (!_clientPromise) {
    _clientPromise = (async () => {
      const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      _client = mod.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
      return _client;
    })();
  }
  return _clientPromise;
}

const Cloud = {
  configured: () => !!getConfig(),
  config: () => getConfig(),
  saveConfig(url, key) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify({ SUPABASE_URL: String(url).trim().replace(/\/$/, ''), SUPABASE_ANON_KEY: String(key).trim() })); } catch (e) {}
    _client = null; _clientPromise = null;
  },
  clearConfig() { try { localStorage.removeItem(CFG_KEY); } catch (e) {} _client = null; _clientPromise = null; },

  async getUser() { try { const c = await getClient(); if (!c) return null; const { data } = await c.auth.getUser(); return data?.user || null; } catch (e) { return null; } },
  async signUp(email, password) { const c = await getClient(); if (!c) throw new Error('Connect your cloud first'); const { data, error } = await c.auth.signUp({ email, password }); if (error) throw error; return data; },
  async signIn(email, password) { const c = await getClient(); if (!c) throw new Error('Connect your cloud first'); const { data, error } = await c.auth.signInWithPassword({ email, password }); if (error) throw error; return data; },
  async signOut() { const c = await getClient(); if (c) await c.auth.signOut(); },

  // book sync (called from the app whenever the library changes, if signed in)
  async syncBooks(books) {
    try {
      const c = await getClient(); if (!c) return;
      const u = await Cloud.getUser(); if (!u) return;
      const rows = (books || []).map(b => ({ id: b.id, user_id: u.id, title: b.title, author: b.author || null, type: b.type || 'book', notes: b.notes || null }));
      if (rows.length) await c.from('books').upsert(rows);
    } catch (e) {}
  },
  async fetchBooks() { try { const c = await getClient(); if (!c) return null; const u = await Cloud.getUser(); if (!u) return null; const { data } = await c.from('books').select('*').order('created_at', { ascending: false }); return data || []; } catch (e) { return null; } },

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
};

if (typeof window !== 'undefined') window.KithraCloud = Cloud;
export default Cloud;
