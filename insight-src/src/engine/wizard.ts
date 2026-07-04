// The clarifying-questions wizard: schema-aware questions the app asks
// BEFORE building dashboards, and the decoding of answers into intent.
import type {
  AggKind, AnalysisIntent, ColumnRef, DataTable, Relation,
  WizardAnswers, WizardOption, WizardQuestion,
} from '../contracts/types';
import { categoryQuality } from './profile';

const DOMAIN_HINTS: { re: RegExp; id: string; label: string }[] = [
  { re: /revenue|sales|order|amount|price|gmv|invoice value/i, id: 'sales', label: 'Sales & revenue performance' },
  { re: /invoice|due|payment|outstanding|receivab|payab|credit/i, id: 'receivables', label: 'Receivables & payment aging' },
  { re: /stock|inventory|sku|warehouse|qty on hand|reorder/i, id: 'inventory', label: 'Inventory & stock health' },
  { re: /shipment|delivery|courier|dispatch|transit|logistics|freight/i, id: 'logistics', label: 'Logistics & deliveries' },
  { re: /employee|salary|attendance|leave|hr\b/i, id: 'people', label: 'People & HR' },
  { re: /spend|cost|budget|expense|procurement/i, id: 'costs', label: 'Costs & spend' },
  { re: /campaign|clicks|impressions|leads|conversion/i, id: 'marketing', label: 'Marketing performance' },
];

export const refId = (tableId: string, column: string) => `${tableId}::${column}`;
export function decodeRef(id: string): ColumnRef | null {
  const i = id.indexOf('::');
  return i < 0 ? null : { tableId: id.slice(0, i), column: id.slice(i + 2) };
}

function tableName(tables: DataTable[], id: string): string {
  return tables.find((t) => t.id === id)?.name ?? '';
}

export function buildWizard(tables: DataTable[], _relations: Relation[]): WizardQuestion[] {
  const qs: WizardQuestion[] = [];
  const allText = tables.flatMap((t) => t.columns).join(' ');
  const multiTable = tables.length > 1;

  // 1 · goal
  const goals: WizardOption[] = DOMAIN_HINTS.filter((d) => d.re.test(allText))
    .map((d) => ({ id: d.id, label: d.label }));
  goals.push({ id: 'explore', label: 'General exploration', hint: 'Let Insight decide what matters' });
  qs.push({
    id: 'goal',
    text: 'What should this analysis help you decide?',
    why: 'The goal decides which charts lead your dashboard and how the AI analyst frames its answers.',
    kind: 'single',
    options: goals,
    defaultAnswer: [goals[0].id],
  });

  // 2 · date column
  const dateRefs: WizardOption[] = [];
  let bestDate: { id: string; coverage: number } | null = null;
  for (const t of tables) {
    for (const p of t.profiles) {
      if (!p.isDate) continue;
      const id = refId(t.id, p.name);
      const coverage = p.nonNullCount / Math.max(1, t.rowCount);
      dateRefs.push({
        id,
        label: multiTable ? `${p.name} — ${t.name}` : p.name,
        hint: `${p.min ?? '…'} → ${p.max ?? '…'}`,
      });
      if (!bestDate || coverage > bestDate.coverage) bestDate = { id, coverage };
    }
  }
  if (dateRefs.length) {
    qs.push({
      id: 'dateColumn',
      text: 'Which date should drive timelines and aging?',
      why: 'Trends over time and "how old is this?" buckets are both measured from this date.',
      kind: 'column', columnFilter: 'date',
      options: dateRefs,
      defaultAnswer: bestDate ? [bestDate.id] : undefined,
    });
    qs.push({
      id: 'aging',
      text: 'How do you like your aging buckets?',
      why: 'Items get grouped by how many days old they are — useful for overdue payments, old stock, pending orders.',
      kind: 'single',
      options: [
        { id: '30,60,90', label: '30 / 60 / 90 days', hint: 'classic receivables view' },
        { id: '15,30,45', label: '15 / 30 / 45 days' },
        { id: '7,14,30', label: '7 / 14 / 30 days', hint: 'fast-moving operations' },
        { id: '60,120,180', label: '60 / 120 / 180 days', hint: 'long cycles' },
        { id: 'none', label: 'No aging needed' },
      ],
      defaultAnswer: ['30,60,90'],
    });
  }

  // 3 · filters — ranked by how good a human dimension each column is
  const catRanked: { opt: WizardOption; q: number }[] = [];
  for (const t of tables) {
    for (const p of t.profiles) {
      if (!p.isCategory) continue;
      catRanked.push({
        opt: {
          id: refId(t.id, p.name),
          label: multiTable ? `${p.name} — ${t.name}` : p.name,
          hint: (p.topValues ?? []).slice(0, 3).map((v) => v.value).join(' · '),
        },
        q: categoryQuality(p, t.rowCount),
      });
    }
  }
  catRanked.sort((a, b) => b.q - a.q);
  const catOpts: WizardOption[] = catRanked.map((x) => x.opt);
  if (catOpts.length) {
    const defaults = catOpts.slice(0, 3).map((x) => x.id);
    qs.push({
      id: 'filters',
      text: 'Which fields do you want as dashboard filters?',
      why: 'These become dropdowns on every dashboard, so you can slice all charts at once.',
      kind: 'multi',
      options: catOpts.slice(0, 12),
      defaultAnswer: defaults,
    });
  }

  // 4 · KPIs
  const kpiOpts: WizardOption[] = [];
  const kpiRank: { id: string; mag: number }[] = [];
  for (const t of tables) {
    for (const p of t.profiles) {
      if (!p.isMetric) continue;
      const agg: AggKind = 'sum';
      const id = `${refId(t.id, p.name)}::${agg}`;
      kpiOpts.push({
        id,
        label: `Total ${p.name}${multiTable ? ` — ${t.name}` : ''}`,
        hint: `currently ${p.sum !== undefined ? Math.round(p.sum).toLocaleString() : '…'}`,
      });
      kpiRank.push({ id, mag: Math.abs(p.sum ?? 0) });
    }
  }
  if (kpiOpts.length) {
    qs.push({
      id: 'kpis',
      text: 'Which numbers are your headline KPIs?',
      why: 'They appear as big cards at the top of the dashboard and anchor the AI analyst\'s summaries.',
      kind: 'multi',
      options: kpiOpts.slice(0, 12),
      defaultAnswer: kpiRank.sort((a, b) => b.mag - a.mag).slice(0, 3).map((x) => x.id),
    });
  }

  // 5 · compare dimension
  if (catOpts.length >= 2) {
    qs.push({
      id: 'compareBy',
      text: 'When comparing performance, which dimension matters most?',
      why: 'Used for the main breakdown chart and for "best vs worst" insights.',
      kind: 'single',
      options: catOpts.slice(0, 8),
      optional: true,
      defaultAnswer: catOpts[0] ? [catOpts[0].id] : undefined,
    });
  }
  return qs;
}

export function buildIntent(
  tables: DataTable[],
  answers: WizardAnswers,
  questions: WizardQuestion[],
): AnalysisIntent {
  const get = (id: string): string[] =>
    answers[id] ?? questions.find((q) => q.id === id)?.defaultAnswer ?? [];

  const goalId = get('goal')[0] ?? 'explore';
  const goal =
    questions.find((q) => q.id === 'goal')?.options?.find((o) => o.id === goalId)?.label ??
    'General exploration';

  const dateColumn = decodeRef(get('dateColumn')[0] ?? '') ?? bestDateRef(tables);
  const agingRaw = get('aging')[0];
  const agingBuckets =
    agingRaw && agingRaw !== 'none'
      ? agingRaw.split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : undefined;

  let filterColumns = get('filters').map(decodeRef).filter((r): r is ColumnRef => !!r);
  if (!filterColumns.length) filterColumns = defaultCategories(tables, 3);

  let kpis = get('kpis')
    .map((id) => {
      const parts = id.split('::');
      if (parts.length < 3) return null;
      return { ref: { tableId: parts[0], column: parts[1] }, agg: parts[2] as AggKind };
    })
    .filter((k): k is { ref: ColumnRef; agg: AggKind } => !!k);
  if (!kpis.length) kpis = defaultKpis(tables, 3);

  const compareBy = decodeRef(get('compareBy')[0] ?? '') ?? undefined;

  // currency: any profiled metric column that carried a symbol
  let currency: string | undefined;
  for (const t of tables) {
    for (const p of t.profiles) {
      if (p.isMetric && /revenue|amount|price|value|cost|spend|salary|total/i.test(p.name)) {
        currency = currency ?? inferCurrencySymbol(t, p.name);
      }
    }
  }

  return {
    goal,
    dateColumn: dateColumn ?? undefined,
    agingBuckets: dateColumn ? agingBuckets : undefined,
    filterColumns, kpis, compareBy, currency,
  };
}

function inferCurrencySymbol(_t: DataTable, _col: string): string | undefined {
  return undefined; // symbols were stripped at parse; UI can set later via settings
}

function bestDateRef(tables: DataTable[]): ColumnRef | null {
  let best: { ref: ColumnRef; cov: number } | null = null;
  for (const t of tables) {
    for (const p of t.profiles) {
      if (!p.isDate) continue;
      const cov = p.nonNullCount / Math.max(1, t.rowCount);
      if (!best || cov > best.cov) best = { ref: { tableId: t.id, column: p.name }, cov };
    }
  }
  return best?.ref ?? null;
}

function defaultCategories(tables: DataTable[], n: number): ColumnRef[] {
  const out: { ref: ColumnRef; q: number }[] = [];
  for (const t of tables) {
    for (const p of t.profiles) {
      if (!p.isCategory) continue;
      out.push({ ref: { tableId: t.id, column: p.name }, q: categoryQuality(p, t.rowCount) });
    }
  }
  return out.sort((a, b) => b.q - a.q).slice(0, n).map((x) => x.ref);
}

function defaultKpis(tables: DataTable[], n: number) {
  const out: { ref: ColumnRef; agg: AggKind; mag: number }[] = [];
  for (const t of tables) {
    for (const p of t.profiles) {
      if (!p.isMetric) continue;
      out.push({ ref: { tableId: t.id, column: p.name }, agg: 'sum', mag: Math.abs(p.sum ?? 0) });
    }
  }
  return out.sort((a, b) => b.mag - a.mag).slice(0, n).map(({ ref, agg }) => ({ ref, agg }));
}
