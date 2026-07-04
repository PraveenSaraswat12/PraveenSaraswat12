// Effective plan resolution + entitlement checks + daily usage counters.
import type { PlanId, Subscription } from '../contracts/types';
import { fetchSubscription } from '../platform/cloud';
import { backendToPlanId, planById } from './plans';

const DEMO_KEY = 'ki_demo_plan';
const SUB_CACHE_KEY = 'ki_sub_cache';
const USAGE_PREFIX = 'ki_usage_';

type PlanListener = (plan: PlanId) => void;
const listeners = new Set<PlanListener>();
let lastEmitted: PlanId | null = null;

export function onPlanChange(cb: PlanListener): () => void {
  listeners.add(cb);
  if (typeof window !== 'undefined' && listeners.size === 1) {
    window.addEventListener('storage', (e) => {
      if (e.key === DEMO_KEY || e.key === SUB_CACHE_KEY) emitIfChanged();
    });
  }
  return () => listeners.delete(cb);
}

export function emitIfChanged() {
  const p = currentPlan();
  if (p !== lastEmitted) {
    lastEmitted = p;
    listeners.forEach((cb) => { try { cb(p); } catch { /* listener's problem */ } });
  }
}

interface DemoPlan { plan: PlanId; expiresAt: string; }

export function readDemoPlan(): DemoPlan | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as DemoPlan;
    if (!d.plan || !d.expiresAt || new Date(d.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(DEMO_KEY);
      return null;
    }
    return d;
  } catch { return null; }
}

export function activateDemoPlan(plan: PlanId, days = 7) {
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  localStorage.setItem(DEMO_KEY, JSON.stringify({ plan, expiresAt }));
  emitIfChanged();
}

interface CachedSub { plan?: string; status?: string; period?: string; until?: string | null; }

function readSubCache(): CachedSub | null {
  try {
    const raw = localStorage.getItem(SUB_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedSub) : null;
  } catch { return null; }
}

function subIsActive(s: CachedSub | null): boolean {
  if (!s || !s.plan) return false;
  if (s.status && !/^(active|authorized|trial|created|paid)$/i.test(s.status)) return false;
  if (s.until) {
    const t = new Date(s.until).getTime();
    if (Number.isFinite(t) && t < Date.now()) return false;
  }
  return true;
}

export function currentPlan(): PlanId {
  const sub = readSubCache();
  if (subIsActive(sub)) return backendToPlanId(sub!.plan);
  const demo = readDemoPlan();
  if (demo) return demo.plan;
  return 'free';
}

export async function refreshSubscription(): Promise<Subscription | null> {
  const raw = await fetchSubscription();
  if (raw) {
    const until =
      raw.current_period_end ?? raw.active_until ?? raw.expires_at ?? raw.valid_till ?? null;
    const cached: CachedSub = {
      plan: raw.plan ?? raw.plan_id ?? raw.tier,
      status: raw.status,
      period: raw.period ?? raw.billing_period,
      until: until ? String(until) : null,
    };
    try { localStorage.setItem(SUB_CACHE_KEY, JSON.stringify(cached)); } catch { /* fine */ }
    emitIfChanged();
    if (subIsActive(cached)) {
      return {
        plan: backendToPlanId(cached.plan),
        period: cached.period === 'year' ? 'year' : 'month',
        activeUntil: cached.until ?? undefined,
        raw,
      };
    }
    return null;
  }
  emitIfChanged();
  return null;
}

// ── usage counters (per-day, local) ─────────────────────────────────────────

function dayKey(d = new Date()): string {
  return `${USAGE_PREFIX}${d.toISOString().slice(0, 10)}`;
}

export function usageToday(): { aiQuestions: number } {
  try {
    const raw = localStorage.getItem(dayKey());
    const v = raw ? JSON.parse(raw) : {};
    return { aiQuestions: Number(v.aiQuestions) || 0 };
  } catch { return { aiQuestions: 0 }; }
}

export function recordAIQuestion() {
  try {
    const u = usageToday();
    localStorage.setItem(dayKey(), JSON.stringify({ aiQuestions: u.aiQuestions + 1 }));
    // prune old keys opportunistically
    const cutoff = dayKey(new Date(Date.now() - 7 * 86400000));
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(USAGE_PREFIX) && k < cutoff) localStorage.removeItem(k);
    }
  } catch { /* private mode */ }
}

// ── entitlement checks ───────────────────────────────────────────────────────

const unlimited = (n: number) => n === -1;

export function canAddSource(currentCount: number, fileMB: number): { ok: boolean; reason?: string } {
  const plan = planById(currentPlan());
  const L = plan.limits;
  if (!unlimited(L.maxSources) && currentCount >= L.maxSources) {
    return {
      ok: false,
      reason: `${plan.label} includes ${L.maxSources} data sources — the next plan raises that. Upgrade to keep going.`,
    };
  }
  if (fileMB > L.maxFileMB) {
    return {
      ok: false,
      reason: `That file is ${fileMB.toFixed(1)} MB; ${plan.label} accepts up to ${L.maxFileMB} MB. Upgrade for bigger files.`,
    };
  }
  return { ok: true };
}

export function canAskAI(): { ok: boolean; reason?: string } {
  const plan = planById(currentPlan());
  const used = usageToday().aiQuestions;
  if (used >= plan.limits.aiQuestionsPerDay) {
    return {
      ok: false,
      reason: `You've used all ${plan.limits.aiQuestionsPerDay} AI questions for today on ${plan.label}. Upgrade for a much higher daily limit.`,
    };
  }
  return { ok: true };
}

export function canUseCloudAI(): boolean { return planById(currentPlan()).limits.cloudAI; }
export function canExport(): boolean { return planById(currentPlan()).limits.exports; }
export function canUseScenarios(): boolean { return planById(currentPlan()).limits.scenarios; }
