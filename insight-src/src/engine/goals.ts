// Conversational goals → intent → dashboard proposal.
// The user never picks columns: plain language in, full analysis plan out.
import type {
  AnalysisIntent, ColumnRef, DashboardProposal, DataTable, GoalAnswers,
  GoalChips, ProposalItem, Relation, WidgetSpec,
} from '../contracts/types';
import { buildDashboards } from './dashboards';
import { columnScore } from './nl';
import { categoryQuality } from './profile';
import { bestDateRef, defaultCategories, defaultKpis, DOMAIN_HINTS } from './wizard';
import { titleCase } from './util';

const AGING_RE = /aging|ageing|overdue|outstanding|pending|due|payment|receivab|payab|collect|unpaid/i;
const DUE_NAME_RE = /due|deadline|promis|expiry|expected/i;

// ── chips: tappable suggestions generated from the actual data ──────────────

export function suggestGoalChips(tables: DataTable[], _relations: Relation[]): GoalChips {
  const allText = tables.flatMap((t) => t.columns).join(' ');
  const domains = DOMAIN_HINTS.filter((d) => d.re.test(allText));

  const learn: string[] = domains.map((d) => d.label);
  const cats = defaultCategories(tables, 2).map((r) => r.column);
  const kpi = defaultKpis(tables, 1)[0]?.ref.column;
  if (kpi && cats[0]) learn.push(`Which ${titleCase(cats[0]).toLowerCase()} performs best`);
  if (kpi && bestDateRef(tables)) learn.push(`How ${titleCase(kpi).toLowerCase()} is trending`);
  learn.push('Just explore everything');

  const decide: string[] = [];
  if (AGING_RE.test(allText)) decide.push('Follow up overdue payments');
  if (/stock|inventory|sku/i.test(allText)) decide.push('What to reorder or clear');
  if (kpi) decide.push('Where to focus effort for growth');
  if (/cost|spend|expense/i.test(allText)) decide.push('Where to cut costs');
  decide.push('Spot problems early', 'No specific decision yet');

  const custom: string[] = [];
  if (bestDateRef(tables)) custom.push('Track how old pending items are');
  for (const c of cats) custom.push(`Slice everything by ${titleCase(c)}`);
  custom.push('Monthly comparisons', 'Nothing custom');

  const dedupe = (a: string[]) => [...new Set(a)].slice(0, 5);
  return { learn: dedupe(learn), decide: dedupe(decide), custom: dedupe(custom) };
}

// ── plain language → intent (columns, dates, aging chosen automatically) ────

function findByText<T extends { name: string }>(
  text: string, tables: DataTable[], pred: (p: any) => boolean,
): ColumnRef[] {
  const out: { ref: ColumnRef; s: number }[] = [];
  for (const t of tables) {
    for (const p of t.profiles) {
      if (!pred(p)) continue;
      const s = columnScore(text, p.name);
      if (s >= 0.6) out.push({ ref: { tableId: t.id, column: p.name }, s });
    }
  }
  return out.sort((a, b) => b.s - a.s).map((x) => x.ref);
}

function dedupeRefs(refs: ColumnRef[]): ColumnRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const k = `${r.tableId}::${r.column}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function buildIntentFromGoals(
  tables: DataTable[],
  _relations: Relation[],
  goals: GoalAnswers,
): AnalysisIntent {
  const text = [goals.learn, goals.decide, goals.custom].filter(Boolean).join('. ');
  const allCols = tables.flatMap((t) => t.columns).join(' ');

  // goal label: first sensible phrase, else domain, else exploration
  const domain = DOMAIN_HINTS.find((d) => d.re.test(text)) ??
    DOMAIN_HINTS.find((d) => d.re.test(allCols));
  const goal =
    (goals.learn && goals.learn.trim().slice(0, 80)) ||
    domain?.label ||
    'General exploration';

  // aging: wanted when the user says so, the domain implies it, or a due-date exists
  const wantsAging = AGING_RE.test(text) || domain?.id === 'receivables';
  // custom buckets like "15/30/45" typed anywhere
  const bm = /(\d{1,3})\s*[\/,]\s*(\d{1,3})\s*[\/,]\s*(\d{1,3})/.exec(text);
  const buckets = bm
    ? [+bm[1], +bm[2], +bm[3]].filter((n) => n > 0).sort((a, b) => a - b)
    : [30, 60, 90];

  // date column: aging prefers a due-style date; otherwise best coverage
  let dateColumn = bestDateRef(tables) ?? undefined;
  if (wantsAging) {
    outer: for (const t of tables) {
      for (const p of t.profiles) {
        if (p.isDate && DUE_NAME_RE.test(p.name)) {
          dateColumn = { tableId: t.id, column: p.name };
          break outer;
        }
      }
    }
  }

  // filters: mentioned categories first, then the best defaults — aim for 4
  const mentioned = findByText(text, tables, (p) => p.isCategory);
  const filterColumns = dedupeRefs([...mentioned, ...defaultCategories(tables, 4)]).slice(0, 4);

  // KPIs: mentioned metrics first, then defaults — aim for 3
  const mentionedMetrics = findByText(text, tables, (p) => p.isMetric);
  const kpis = dedupeRefs([
    ...mentionedMetrics,
    ...defaultKpis(tables, 3).map((k) => k.ref),
  ]).slice(0, 3).map((ref) => ({ ref, agg: 'sum' as const }));

  // compare dimension: strongest mentioned category, else best quality
  const compareBy =
    mentioned[0] ??
    (() => {
      let best: { ref: ColumnRef; q: number } | null = null;
      for (const t of tables) {
        for (const p of t.profiles) {
          if (!p.isCategory) continue;
          const q = categoryQuality(p, t.rowCount);
          if (!best || q > best.q) best = { ref: { tableId: t.id, column: p.name }, q };
        }
      }
      return best?.ref;
    })();

  return {
    goal,
    dateColumn,
    agingBuckets: wantsAging && dateColumn ? buckets : undefined,
    filterColumns,
    kpis,
    compareBy,
    currency: undefined,
  };
}

// ── the approval plan ────────────────────────────────────────────────────────

const WIDGET_REASON: Record<WidgetSpec['type'], string> = {
  kpi: 'A headline number, always visible at the top',
  line: 'Shows the direction over time — growing or slipping?',
  area: 'Shows the direction over time — growing or slipping?',
  bar: 'Compares performance side by side',
  stackedBar: 'Compares composition side by side',
  pie: 'Who contributes how much (%)',
  donut: 'Who contributes how much (%)',
  aging: 'How old pending items are, in day buckets',
  table: 'The underlying rows — sortable and searchable',
  scatter: 'The relationship between two numbers',
};

export function proposeDashboards(
  tables: DataTable[],
  relations: Relation[],
  intent: AnalysisIntent,
): DashboardProposal {
  const dashboards = buildDashboards(tables, relations, intent);
  const items: ProposalItem[] = [];
  for (const d of dashboards) {
    for (const w of d.widgets) {
      items.push({
        id: w.id,
        kind: 'widget',
        dashboardName: d.name,
        title: w.title,
        reason: WIDGET_REASON[w.type],
        enabled: true,
        widget: w,
      });
    }
    for (const f of d.globalFilterColumns) {
      items.push({
        id: `f:${d.id}:${f.tableId}:${f.column}`,
        kind: 'filter',
        dashboardName: d.name,
        title: `Filter: ${titleCase(f.column)}`,
        reason: `A dropdown that slices every chart by ${titleCase(f.column).toLowerCase()}`,
        enabled: true,
        filterRef: f,
      });
    }
  }
  return { intent, dashboards, items };
}

/** apply the user's enabled/disabled choices to the pre-built specs */
export function applyProposal(proposal: DashboardProposal, enabledIds: Set<string>) {
  const dashboards = proposal.dashboards
    .map((d) => ({
      ...d,
      widgets: d.widgets.filter((w) => enabledIds.has(w.id)),
      globalFilterColumns: d.globalFilterColumns.filter((f) =>
        enabledIds.has(`f:${d.id}:${f.tableId}:${f.column}`),
      ),
    }))
    .filter((d) => d.widgets.length > 0);
  return dashboards;
}
