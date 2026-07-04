// The four Kithra Insight tiers. Pro/Premium ride the existing Kithra
// payment rails (backend plan ids 'plus' / 'premium'), so one subscription
// works across all Kithra products.
import type { PlanDef, PlanId } from '../contracts/types';

export const PLANS: PlanDef[] = [
  {
    id: 'free',
    label: 'Free',
    tagline: 'Start analysing today',
    monthlyUSD: 0,
    yearlyUSD: 0,
    features: [
      'Excel, CSV, PDF, JSON, code & web links',
      'Auto-built interactive dashboards',
      'Clarifying-questions wizard',
      'Local AI analyst — answers from your data',
      '100% on-device, private analysis',
      'Encrypted local storage',
    ],
    limits: {
      maxSources: 3,
      maxFileMB: 2,
      maxRowsPerTable: 20000,
      aiQuestionsPerDay: 10,
      cloudAI: false,
      exports: false,
      scenarios: false,
      maxWorkspaces: 2,
    },
  },
  {
    id: 'pro',
    label: 'Pro',
    tagline: 'For people who decide with data',
    monthlyUSD: 30,
    yearlyUSD: 300,
    backendPlan: 'plus',
    highlight: true,
    features: [
      'Everything in Free',
      'Cloud AI analyst — deeper reasoning',
      '25 data sources · 25 MB files',
      'Export charts & tables',
      'Encrypted backup files',
      'Priority email support',
    ],
    limits: {
      maxSources: 25,
      maxFileMB: 25,
      maxRowsPerTable: 250000,
      aiQuestionsPerDay: 200,
      cloudAI: true,
      exports: true,
      scenarios: false,
      maxWorkspaces: 15,
    },
  },
  {
    id: 'premium',
    label: 'Premium',
    tagline: 'Your always-on analyst',
    monthlyUSD: 90,
    yearlyUSD: 900,
    backendPlan: 'premium',
    features: [
      'Everything in Pro',
      'What-if scenarios & forecasts',
      'Unlimited datasets & workspaces',
      '100 MB files · 1M rows per table',
      'First access to new features',
    ],
    limits: {
      maxSources: -1,
      maxFileMB: 100,
      maxRowsPerTable: 1000000,
      aiQuestionsPerDay: 1000,
      cloudAI: true,
      exports: true,
      scenarios: true,
      maxWorkspaces: -1,
    },
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    tagline: 'For teams and serious scale',
    monthlyUSD: null,
    yearlyUSD: null,
    features: [
      'Everything in Premium',
      'Team workspaces (roadmap)',
      'SSO & admin controls (roadmap)',
      'Custom data residency',
      'Dedicated support & onboarding',
      'Invoiced billing',
    ],
    limits: {
      maxSources: -1,
      maxFileMB: 500,
      maxRowsPerTable: -1,
      aiQuestionsPerDay: 100000,
      cloudAI: true,
      exports: true,
      scenarios: true,
      maxWorkspaces: -1,
    },
  },
];

export function planById(id: PlanId): PlanDef {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** backend subscription plan → Insight tier */
export function backendToPlanId(backend: string | null | undefined): PlanId {
  if (backend === 'plus') return 'pro';
  if (backend === 'premium') return 'premium';
  return 'free';
}

export const ENTERPRISE_CONTACT =
  'mailto:smyttenorders@smytten.com?subject=Kithra%20Insight%20Enterprise';
