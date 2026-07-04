// QA: plan definitions, entitlements, usage, demo plans, checkout flow.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { billing } from '../index';
import { PLANS, backendToPlanId, planById } from '../plans';
import {
  activateDemoPlan, canAddSource, canAskAI, currentPlan, recordAIQuestion, usageToday,
} from '../entitlements';
import { checkout, deps } from '../checkout';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('plans', () => {
  it('has the four tiers in order with sane shapes', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['free', 'pro', 'premium', 'enterprise']);
    expect(PLANS.find((p) => p.highlight)?.id).toBe('pro');
    expect(planById('pro').backendPlan).toBe('plus');
    expect(planById('premium').backendPlan).toBe('premium');
    expect(planById('free').monthlyUSD).toBe(0);
    expect(planById('enterprise').monthlyUSD).toBeNull();
  });
  it('limits grow monotonic free → pro → premium', () => {
    const [f, p, pr] = [planById('free').limits, planById('pro').limits, planById('premium').limits];
    expect(p.maxFileMB).toBeGreaterThan(f.maxFileMB);
    expect(pr.maxFileMB).toBeGreaterThan(p.maxFileMB);
    expect(p.aiQuestionsPerDay).toBeGreaterThan(f.aiQuestionsPerDay);
    expect(f.cloudAI).toBe(false);
    expect(p.cloudAI && pr.cloudAI).toBe(true);
    expect(pr.scenarios).toBe(true);
    expect(p.scenarios).toBe(false);
  });
  it('maps backend plans', () => {
    expect(backendToPlanId('plus')).toBe('pro');
    expect(backendToPlanId('premium')).toBe('premium');
    expect(backendToPlanId(undefined)).toBe('free');
  });
});

describe('entitlements', () => {
  it('defaults to free and gates accordingly', () => {
    expect(currentPlan()).toBe('free');
    expect(canAddSource(0, 1).ok).toBe(true);
    expect(canAddSource(3, 1).ok).toBe(false);
    expect(canAddSource(3, 1).reason).toMatch(/upgrade/i);
    expect(canAddSource(0, 5).ok).toBe(false); // 5MB > 2MB free cap
    expect(billing.canUseCloudAI()).toBe(false);
    expect(billing.canExport()).toBe(false);
    expect(billing.canUseScenarios()).toBe(false);
  });

  it('demo plans elevate and expire', () => {
    activateDemoPlan('premium', 7);
    expect(currentPlan()).toBe('premium');
    expect(billing.canUseScenarios()).toBe(true);
    // expired
    localStorage.setItem('ki_demo_plan', JSON.stringify({ plan: 'premium', expiresAt: new Date(Date.now() - 1000).toISOString() }));
    expect(currentPlan()).toBe('free');
  });

  it('active cached subscription wins; expired falls back', () => {
    localStorage.setItem('ki_sub_cache', JSON.stringify({ plan: 'plus', status: 'active', until: new Date(Date.now() + 86400000).toISOString() }));
    expect(currentPlan()).toBe('pro');
    localStorage.setItem('ki_sub_cache', JSON.stringify({ plan: 'plus', status: 'active', until: new Date(Date.now() - 86400000).toISOString() }));
    expect(currentPlan()).toBe('free');
    localStorage.setItem('ki_sub_cache', JSON.stringify({ plan: 'premium', status: 'cancelled' }));
    expect(currentPlan()).toBe('free');
  });

  it('counts AI usage per day and enforces the cap', () => {
    expect(usageToday().aiQuestions).toBe(0);
    for (let i = 0; i < 10; i++) recordAIQuestion();
    expect(usageToday().aiQuestions).toBe(10);
    expect(canAskAI().ok).toBe(false); // free cap = 10
    expect(canAskAI().reason).toMatch(/upgrade/i);
    activateDemoPlan('pro');
    expect(canAskAI().ok).toBe(true); // 200/day on pro
  });
});

describe('checkout', () => {
  it('rejects free/enterprise/guest paths with guidance', async () => {
    vi.spyOn(deps, 'getSupabase').mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: null } }) },
    });
    expect((await checkout('free', 'month')).ok).toBe(false);
    expect((await checkout('enterprise', 'month')).message).toMatch(/contact/i);
    const r = await checkout('pro', 'month');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/sign in/i);
  });

  it('completes a paid flow: order → razorpay → verify → refresh', async () => {
    vi.spyOn(deps, 'getSupabase').mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
    });
    const order = { key_id: 'rzp_x', amount: 3000, currency: 'USD', order_id: 'ord_1' };
    const createOrder = vi.spyOn(deps, 'createOrder').mockResolvedValue(order);
    vi.spyOn(deps, 'loadRazorpay').mockResolvedValue(undefined);
    const verify = vi.spyOn(deps, 'verifyPayment').mockResolvedValue({ ok: true });
    const refresh = vi.spyOn(deps, 'refreshSubscription').mockResolvedValue(null);
    vi.spyOn(deps, 'openRazorpay').mockImplementation((opts: any) => {
      expect(opts.order_id).toBe('ord_1');
      expect(opts.name).toBe('Kithra');
      opts.handler({ razorpay_payment_id: 'pay_1', razorpay_order_id: 'ord_1', razorpay_signature: 'sig' });
    });
    const r = await checkout('pro', 'month');
    expect(r).toEqual({ ok: true, mode: 'paid', message: expect.stringMatching(/welcome/i) });
    expect(createOrder).toHaveBeenCalledWith('plus', 'month', expect.any(String));
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ plan: 'plus', period: 'month' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('dismissing checkout charges nothing', async () => {
    vi.spyOn(deps, 'getSupabase').mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
    });
    vi.spyOn(deps, 'createOrder').mockResolvedValue({ key_id: 'k', amount: 1, currency: 'USD', id: 'o' });
    vi.spyOn(deps, 'loadRazorpay').mockResolvedValue(undefined);
    const verify = vi.spyOn(deps, 'verifyPayment');
    vi.spyOn(deps, 'openRazorpay').mockImplementation((opts: any) => opts.modal.ondismiss());
    const r = await checkout('premium', 'year');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/closed/i);
    expect(verify).not.toHaveBeenCalled();
  });

  it('falls back to a labelled 7-day preview when payments are unreachable', async () => {
    vi.spyOn(deps, 'getSupabase').mockResolvedValue({
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
    });
    vi.spyOn(deps, 'createOrder').mockRejectedValue(new Error('network'));
    const r = await checkout('pro', 'month');
    expect(r.ok).toBe(true);
    expect(r.mode).toBe('demo');
    expect(r.message).toMatch(/preview/i);
    expect(currentPlan()).toBe('pro');
  });
});
