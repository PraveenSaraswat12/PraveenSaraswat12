// Auth: Kithra cloud sign-in (Google / phone OTP via Supabase) + local guest.
import type { SessionUser } from '../contracts/types';
import { getSupabase } from '../platform/cloud';

const GUEST_KEY = 'ki_guest';

type Listener = (user: SessionUser | null) => void;
const listeners = new Set<Listener>();
let current: SessionUser | null = null;
let cloudWired = false;

function notify(u: SessionUser | null) {
  current = u;
  listeners.forEach((cb) => { try { cb(u); } catch { /* listener errors are theirs */ } });
}

export function onAuthChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function currentUser(): SessionUser | null { return current; }

function mapUser(u: any): SessionUser {
  const provider = u?.app_metadata?.provider === 'phone' ? 'phone' : 'google';
  return {
    id: u.id,
    email: u.email ?? undefined,
    phone: u.phone ?? undefined,
    name:
      u.user_metadata?.full_name ||
      u.user_metadata?.name ||
      (u.email ? String(u.email).split('@')[0] : undefined) ||
      (u.phone ? `+${String(u.phone).replace(/^\+/, '')}` : 'Member'),
    provider,
  };
}

function readGuest(): SessionUser | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw);
    return g && g.id ? (g as SessionUser) : null;
  } catch { return null; }
}

async function wireCloud(): Promise<SessionUser | null> {
  try {
    const sb = await getSupabase();
    if (!cloudWired) {
      cloudWired = true;
      sb.auth.onAuthStateChange((_event: string, session: any) => {
        if (readGuest()) return; // guest mode wins until explicitly signed out
        notify(session?.user ? mapUser(session.user) : null);
      });
    }
    const { data } = await sb.auth.getSession();
    return data?.session?.user ? mapUser(data.session.user) : null;
  } catch {
    return null; // offline → app continues locally
  }
}

export async function init(): Promise<SessionUser | null> {
  const guest = readGuest();
  if (guest) { notify(guest); return guest; }
  // only touch the network when a session might exist (avoids cold-start fetch)
  const mightHaveSession =
    typeof location !== 'undefined' && /access_token|code=/.test(location.hash + location.search)
    || Object.keys(localStorage).some((k) => k.startsWith('sb-'));
  if (!mightHaveSession) { notify(null); return null; }
  const u = await wireCloud();
  notify(u);
  return u;
}

export async function signInWithGoogle(): Promise<void> {
  const sb = await getSupabase();
  localStorage.removeItem(GUEST_KEY);
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: location.origin + location.pathname,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw new Error(error.message || 'Google sign-in failed');
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`; // bare Indian mobile
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  throw new Error('Enter a valid phone number with country code, e.g. +91 98765 43210');
}

export async function sendPhoneOtp(phone: string): Promise<void> {
  const p = normalizePhone(phone);
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOtp({ phone: p });
  if (error) throw new Error(error.message || 'Could not send the code');
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<SessionUser> {
  const p = normalizePhone(phone);
  const sb = await getSupabase();
  const { data, error } = await sb.auth.verifyOtp({ phone: p, token: token.trim(), type: 'sms' });
  if (error || !data?.user) throw new Error(error?.message || 'That code did not match');
  localStorage.removeItem(GUEST_KEY);
  const u = mapUser(data.user);
  notify(u);
  return u;
}

export async function continueAsGuest(name?: string): Promise<SessionUser> {
  const u: SessionUser = {
    id: `guest-${crypto.randomUUID()}`,
    name: name?.trim() || 'Guest',
    provider: 'guest',
  };
  localStorage.setItem(GUEST_KEY, JSON.stringify(u));
  notify(u);
  return u;
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(GUEST_KEY);
  try {
    if (Object.keys(localStorage).some((k) => k.startsWith('sb-'))) {
      const sb = await getSupabase();
      await sb.auth.signOut();
    }
  } catch { /* offline sign-out is still a sign-out locally */ }
  notify(null);
}
