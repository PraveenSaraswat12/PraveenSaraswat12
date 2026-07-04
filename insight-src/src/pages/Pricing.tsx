// Pricing: 4 tiers, month/year toggle, Razorpay checkout, limits table, FAQ.
import React, { useState } from 'react';
import { billing, ENTERPRISE_CONTACT } from '../billing';
import { detectCurrency } from '../platform/cloud';
import { Badge, Button, Card, cx } from '../ui/components';
import { CheckIcon } from '../ui/icons';
import { TopNav } from './Landing';
import { useApp, useAuth } from '../ui/state/stores';
import type { PlanDef } from '../contracts/types';

const LIMIT_ROWS: { label: string; get: (p: PlanDef) => string }[] = [
  { label: 'Data sources', get: (p) => (p.limits.maxSources === -1 ? 'Unlimited' : String(p.limits.maxSources)) },
  { label: 'File size', get: (p) => `${p.limits.maxFileMB} MB` },
  { label: 'Rows per table', get: (p) => (p.limits.maxRowsPerTable === -1 ? 'Unlimited' : p.limits.maxRowsPerTable.toLocaleString()) },
  { label: 'AI questions / day', get: (p) => p.limits.aiQuestionsPerDay.toLocaleString() },
  { label: 'Cloud AI analyst', get: (p) => (p.limits.cloudAI ? 'Yes' : '—') },
  { label: 'Exports', get: (p) => (p.limits.exports ? 'Yes' : '—') },
  { label: 'Forecasts & projections', get: (p) => (p.limits.scenarios ? 'Yes' : '—') },
  { label: 'Workspaces', get: (p) => (p.limits.maxWorkspaces === -1 ? 'Unlimited' : String(p.limits.maxWorkspaces)) },
];

const FAQS: [string, string][] = [
  ['How do payments work?', 'Checkout is handled by Razorpay — cards, UPI, netbanking and wallets. In India you are billed in INR; elsewhere in USD. Your card details never touch our code.'],
  ['Can I cancel anytime?', 'Yes. Plans are simple subscriptions; if you stop paying you simply drop back to Free at the end of the period. Your data stays on your device either way.'],
  ['What stays on my device?', 'Everything — your files, tables, dashboards and chat history are processed in your browser and stored encrypted on your device. We never see raw rows.'],
  ['What does the cloud AI see?', 'Only compact numeric summaries (totals, top categories, column names) and only when you have switched cloud consent on. Raw data is never sent.'],
  ['Do you offer refunds?', 'If something is broken and we cannot fix it for you within a week, we refund the current period. Just email us.'],
];

export default function Pricing() {
  const plans = billing.plans();
  const currentPlan = useAuth((s) => s.plan);
  const user = useAuth((s) => s.user);
  const navigate = useApp((s) => s.navigate);
  const toast = useApp((s) => s.toast);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [busy, setBusy] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const inr = detectCurrency() === 'INR';

  const buy = async (planId: PlanDef['id']) => {
    if (planId === 'enterprise') { window.location.href = ENTERPRISE_CONTACT; return; }
    if (planId === 'free') { navigate(user ? 'studio' : 'auth'); return; }
    if (!user || user.provider === 'guest') {
      toast('info', 'Sign in with Google or phone first, so your plan can follow you.');
      navigate('auth');
      return;
    }
    setBusy(planId);
    try {
      const r = await billing.checkout(planId, period);
      toast(r.ok ? (r.mode === 'demo' ? 'warn' : 'success') : 'error', r.message);
    } finally { setBusy(null); }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="max-w-6xl mx-auto px-5 py-14">
        <h1 className="font-display text-3xl text-mist-50 text-center">Plans that grow with your data</h1>
        <p className="text-mist-400 text-center text-sm mt-2">
          Prices in USD{inr && ' — billed in INR at checkout for India'}.
        </p>

        {/* period toggle */}
        <div className="flex justify-center mt-7">
          <div className="glass rounded-full p-1 flex text-sm">
            {(['month', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cx(
                  'px-5 py-1.5 rounded-full transition',
                  period === p ? 'bg-gradient-to-r from-pulse-500 to-aura-500 text-white' : 'text-mist-400 hover:text-mist-100',
                )}
              >
                {p === 'month' ? 'Monthly' : <>Yearly <span className="text-glow-400">· 2 months free</span></>}
              </button>
            ))}
          </div>
        </div>

        {/* plan cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          {plans.map((p) => {
            const price = period === 'month' ? p.monthlyUSD : p.yearlyUSD;
            const isCurrent = currentPlan === p.id && p.id !== 'free';
            return (
              <Card key={p.id} className={cx('p-6 flex flex-col', p.highlight && 'ring-1 ring-pulse-500/50 shadow-glowBlue')}>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-mist-50">{p.label}</h2>
                  {p.highlight && <Badge>Most popular</Badge>}
                  {isCurrent && <Badge tone="teal">Your plan</Badge>}
                </div>
                <p className="text-xs text-mist-400 mt-1">{p.tagline}</p>
                <div className="font-display text-3xl text-mist-50 mt-4 num">
                  {price === null ? 'Custom' : price === 0 ? '$0' : `$${price}`}
                  {price ? <span className="text-xs text-mist-500 font-body"> /{period === 'month' ? 'mo' : 'yr'}</span> : null}
                </div>
                <ul className="mt-5 space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-mist-300">
                      <CheckIcon size={14} className="text-glow-400 shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-6"
                  variant={p.highlight ? 'primary' : 'soft'}
                  busy={busy === p.id}
                  disabled={isCurrent}
                  onClick={() => buy(p.id)}
                >
                  {p.id === 'free' ? 'Start free' : p.id === 'enterprise' ? 'Contact us' : isCurrent ? 'Active' : `Get ${p.label}`}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* limits table */}
        <Card className="mt-12 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-mist-400 text-xs">
                <th className="px-5 py-3.5 font-medium">What you get</th>
                {plans.map((p) => <th key={p.id} className="px-5 py-3.5 font-medium">{p.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {LIMIT_ROWS.map((row, i) => (
                <tr key={row.label} className={i % 2 ? 'bg-white/[0.02]' : ''}>
                  <td className="px-5 py-2.5 text-mist-300">{row.label}</td>
                  {plans.map((p) => (
                    <td key={p.id} className="px-5 py-2.5 text-mist-50 num">{row.get(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* FAQ */}
        <h2 className="font-display text-xl text-mist-50 text-center mt-14 mb-6">Questions, answered</h2>
        <div className="max-w-2xl mx-auto space-y-2">
          {FAQS.map(([q, a], i) => (
            <Card key={q} className="overflow-hidden">
              <button
                className="w-full text-left px-5 py-3.5 text-sm text-mist-50 flex justify-between items-center"
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                aria-expanded={faqOpen === i}
              >
                {q} <span className="text-mist-500">{faqOpen === i ? '−' : '+'}</span>
              </button>
              {faqOpen === i && <p className="px-5 pb-4 text-xs text-mist-400 anim-fade-up">{a}</p>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
