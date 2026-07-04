// STUB — Agent 1 (Core Logic) replaces this with the full implementation.
// Must keep exporting: export const engine: InsightEngine
import type { InsightEngine } from '../contracts/modules';

export const engine: InsightEngine = {
  async parseFiles() { return { sources: [], tables: [], warnings: [] }; },
  async parseWebUrl() { return { sources: [], tables: [], warnings: [] }; },
  detectRelations() { return []; },
  buildWizard() { return []; },
  buildIntent() { return { goal: '', filterColumns: [], kpis: [] }; },
  buildDashboards() { return []; },
  runQuery(q) {
    return {
      table: { columns: [], types: [], rows: [] },
      meta: { tableId: q.tableId, appliedFilters: [], ms: 0, rowsScanned: 0 },
    };
  },
  generateInsights() { return []; },
  async answer() { return { text: 'Engine not ready yet.', attachments: [], lowConfidence: true }; },
  describeDataForAI() { return ''; },
};
