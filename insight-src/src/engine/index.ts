// Kithra Insight engine — pure data logic behind the whole product.
import type { InsightEngine } from '../contracts/modules';
import { parseFiles } from './io/files';
import { parseWebUrl } from './io/web';
import { detectRelations } from './relations';
import { buildIntent, buildWizard } from './wizard';
import { buildDashboards } from './dashboards';
import { generateInsights } from './insights';
import { runQuery } from './query';
import { answer, describeDataForAI } from './nl';

export const engine: InsightEngine = {
  parseFiles,
  parseWebUrl,
  detectRelations,
  buildWizard,
  buildIntent,
  buildDashboards,
  runQuery,
  generateInsights,
  answer,
  describeDataForAI,
};

// formatting helpers shared with the UI
export { fmtNum, round, titleCase, todayISO, uid } from './util';
export { agingBucketLabels } from './query';
