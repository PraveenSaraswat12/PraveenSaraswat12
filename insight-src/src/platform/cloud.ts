// ─────────────────────────────────────────────────────────────────────────────
// Kithra cloud platform client — talks to the SAME Supabase project and
// Razorpay rails the root Kithra app already uses, so one Kithra account
// works across both products. Owned by the architect; agents extend around
// it (security/ wraps auth, billing/ wraps payments) but do not edit it.
// ─────────────────────────────────────────────────────────────────────────────

export interface KithraConfig { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; }

declare global {
  interface Window {
    KITHRA_CONFIG?: KithraConfig;
    Razorpay?: any;
  }
}

const DEFAULT_CONFIG: KithraConfig = {
  SUPABASE_URL: 'https://elaruyvaroadjlhsddxb.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsYXJ1eXZhcm9hZGpsaHNkZHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODk3MTgsImV4cCI6MjA5NjU2NTcxOH0.h3uHhlK3PNHKkmDkuCymfc1L1E6VtkWbOGedI4PjmN8',
};

export function getConfig(): KithraConfig {
  if (typeof window !== 'undefined' && window.KITHRA_CONFIG?.SUPABASE_URL) return window.KITHRA_CONFIG;
  return DEFAULT_CONFIG;
}

let clientPromise: Promise<any> | null = null;

// kept as a widened string so TS doesn't try to resolve the CDN module
const SUPABASE_CDN: string = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/** supabase-js v2 loaded lazily from CDN (same pattern as root Kithra app) */
export function getSupabase(): Promise<any> {
  if (!clientPromise) {
    const cfg = getConfig();
    clientPromise = import(/* @vite-ignore */ SUPABASE_CDN).then((m) =>
      m.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, storageKey: 'kithra-insight-auth' },
      })
    );
  }
  return clientPromise;
}

/** test hook */
export function __setSupabaseForTests(fake: any) {
  clientPromise = Promise.resolve(fake);
}

async function authedHeaders(): Promise<Record<string, string>> {
  const cfg = getConfig();
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sign in to use cloud features');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: cfg.SUPABASE_ANON_KEY,
  };
}

/** Existing Kithra AI edge function: { prompt, system } → { text } */
export async function cloudAI(prompt: string, system: string): Promise<string> {
  const cfg = getConfig();
  const headers = await authedHeaders();
  const r = await fetch(`${cfg.SUPABASE_URL}/functions/v1/ai`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, system }),
  });
  const j = await r.json().catch(() => ({}) as any);
  if (!r.ok || j.error) throw new Error(j.error || `AI request failed (${r.status})`);
  return j.text || j.answer || j.result || '';
}

/** Existing Kithra payments edge function */
async function payFetch(body: Record<string, unknown>): Promise<any> {
  const cfg = getConfig();
  const headers = await authedHeaders();
  const r = await fetch(`${cfg.SUPABASE_URL}/functions/v1/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}) as any);
  if (!r.ok || j.error) throw new Error(j.error || `Payment request failed (${r.status})`);
  return j;
}

export function createOrder(plan: 'plus' | 'premium', period: 'month' | 'year', currency: string) {
  return payFetch({ action: 'order', plan, period, currency });
}

export function verifyPayment(payload: Record<string, unknown>) {
  return payFetch({ action: 'verify', ...payload });
}

export async function fetchSubscription(): Promise<any | null> {
  try {
    const sb = await getSupabase();
    const { data: s } = await sb.auth.getSession();
    if (!s?.session) return null;
    const { data, error } = await sb
      .from('subscriptions')
      .select('*')
      .eq('user_id', s.session.user.id)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/** Razorpay checkout.js loader (multiple payment methods: card/UPI/netbanking/wallets) */
export function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load payment gateway'));
    document.head.appendChild(s);
  });
}

/** region-aware display currency (mirrors root app: INR for India, else USD) */
export function detectCurrency(): 'INR' | 'USD' {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'INR';
  } catch { /* default below */ }
  return 'USD';
}
