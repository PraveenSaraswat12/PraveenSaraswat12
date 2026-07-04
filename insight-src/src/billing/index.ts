// STUB — Agent 4 (Business) replaces this with the full implementation.
// Must keep exporting: export const billing: BillingModule
import type { BillingModule } from '../contracts/modules';
import type { PlanDef, PlanId } from '../contracts/types';

const FREE: PlanDef = {
  id: 'free', label: 'Free', tagline: 'Start analysing', monthlyUSD: 0, yearlyUSD: 0,
  features: [],
  limits: {
    maxSources: 3, maxFileMB: 2, maxRowsPerTable: 20000, aiQuestionsPerDay: 25,
    cloudAI: false, exports: false, scenarios: false, maxWorkspaces: 2,
  },
};

export const billing: BillingModule = {
  plans() { return [FREE]; },
  plan() { return FREE; },
  currentPlan(): PlanId { return 'free'; },
  async refreshSubscription() { return null; },
  async checkout() { return { ok: false, mode: 'demo', message: 'not implemented' }; },
  onPlanChange() { return () => {}; },
  canAddSource() { return { ok: true }; },
  canAskAI() { return { ok: true }; },
  recordAIQuestion() {},
  usageToday() { return { aiQuestions: 0 }; },
  canUseCloudAI() { return false; },
  canExport() { return false; },
  canUseScenarios() { return false; },
};
