// Razorpay checkout on the existing Kithra payment rails.
// Razorpay's sheet natively offers cards, UPI, netbanking and wallets.
import type { PlanId } from '../contracts/types';
import type { CheckoutResult } from '../contracts/modules';
import {
  createOrder, detectCurrency, getSupabase, loadRazorpay, verifyPayment,
} from '../platform/cloud';
import { activateDemoPlan, refreshSubscription } from './entitlements';
import { planById } from './plans';

/** injectable for tests */
export const deps = {
  createOrder, loadRazorpay, verifyPayment, refreshSubscription, getSupabase,
  openRazorpay(options: any): void {
    const rz = new (window as any).Razorpay(options);
    rz.open();
  },
};

async function hasCloudSession(): Promise<boolean> {
  try {
    const sb = await deps.getSupabase();
    const { data } = await sb.auth.getSession();
    return !!data?.session?.access_token;
  } catch { return false; }
}

export async function checkout(planId: PlanId, period: 'month' | 'year'): Promise<CheckoutResult> {
  const plan = planById(planId);
  if (planId === 'free') {
    return { ok: false, mode: 'paid', message: 'Free needs no checkout — just start analysing.' };
  }
  if (planId === 'enterprise' || !plan.backendPlan) {
    return { ok: false, mode: 'paid', message: 'Enterprise is hand-tailored — use the Contact us button and we will reply within a day.' };
  }
  if (!(await hasCloudSession())) {
    return { ok: false, mode: 'paid', message: 'Sign in with Google or phone first, so your plan can follow you across devices.' };
  }

  let order: any;
  try {
    order = await deps.createOrder(plan.backendPlan, period, detectCurrency());
  } catch {
    // payments backend unreachable → clearly-labelled local preview, no charge
    activateDemoPlan(planId, 7);
    return {
      ok: true,
      mode: 'demo',
      message: `Payments are unreachable right now, so a free 7-day ${plan.label} preview was activated instead. No charge was made.`,
    };
  }

  try {
    await deps.loadRazorpay();
  } catch {
    return { ok: false, mode: 'paid', message: 'Could not load the payment window. Check your connection and try again.' };
  }

  const response = await new Promise<any | null>((resolve) => {
    deps.openRazorpay({
      key: order.key_id ?? order.key,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id ?? order.id,
      name: 'Kithra',
      description: `Insight ${plan.label} · ${period === 'year' ? 'yearly' : 'monthly'}`,
      theme: { color: '#3a6df4' },
      handler: (resp: any) => resolve(resp),
      modal: { ondismiss: () => resolve(null) },
    });
  });

  if (!response) {
    return { ok: false, mode: 'paid', message: 'Checkout closed — nothing was charged.' };
  }

  try {
    await deps.verifyPayment({ ...response, plan: plan.backendPlan, period });
  } catch (e) {
    return {
      ok: false, mode: 'paid',
      message: `Payment went through but could not be verified automatically (${e instanceof Error ? e.message : 'error'}). It will be reconciled — or write to support with your payment id.`,
    };
  }
  await deps.refreshSubscription();
  return { ok: true, mode: 'paid', message: `Welcome to ${plan.label}! Your plan is active.` };
}
