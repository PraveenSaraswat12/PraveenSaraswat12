// Billing module: plans, entitlements, payments.
import type { BillingModule } from '../contracts/modules';
import { checkout } from './checkout';
import {
  canAddSource, canAskAI, canExport, canUseCloudAI, canUseScenarios,
  currentPlan, onPlanChange, recordAIQuestion, refreshSubscription, usageToday,
} from './entitlements';
import { PLANS, planById } from './plans';

export const billing: BillingModule = {
  plans: () => PLANS,
  plan: planById,
  currentPlan,
  refreshSubscription,
  checkout,
  onPlanChange,
  canAddSource,
  canAskAI,
  recordAIQuestion,
  usageToday,
  canUseCloudAI,
  canExport,
  canUseScenarios,
};

export { ENTERPRISE_CONTACT } from './plans';
export { activateDemoPlan } from './entitlements';
