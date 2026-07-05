// The local chat analyst: natural language → AnalyticsQuery → answer with
// real computed numbers. Deterministic, offline, never invents data.
import type {
  AggKind, AnalyticsQuery, ChatAttachment, DataTable, EngineAnswer,
  QueryFilter, TimeGrain, WidgetSpec, WidgetType,
} from '../contracts/types';
import type { AnswerContext, EngineContext } from '../contracts/modules';
import { runQuery } from './query';
import { fmtNum, norm, round, titleCase, todayISO, uid } from './util';

const SYNONYMS: Record<string, string[]> = {
  revenue: ['sales', 'amount', 'value', 'turnover', 'gmv', 'income'],
  quantity: ['qty', 'units', 'volume', 'count', 'pieces', 'pcs'],
  customer: ['client', 'account', 'buyer', 'party'],
  cost: ['expense', 'spend', 'expenditure'],
  profit: ['margin', 'earnings'],
  region: ['zone', 'area', 'territory'],
  category: ['segment', 'type', 'group', 'class'],
  date: ['day', 'time', 'when'],
};

interface ColMatch { tableId: string; column: string; score: number; }

export function columnScore(q: string, col: string): number {
  const nq = norm(q), nc = norm(col);
  if (!nc) return 0;
  if (nq.includes(nc)) return nc.length >= 4 ? 1 : 0.7;
  // synonym hit
  for (const [base, alts] of Object.entries(SYNONYMS)) {
    const group = [base, ...alts];
    const colHit = group.some((g) => nc.includes(norm(g)));
    const qHit = group.some((g) => nq.includes(norm(g)));
    if (colHit && qHit) return 0.8;
  }
  // word-level partial: any 4+ char word of the column appears
  const words = col.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  if (words.some((w) => nq.includes(norm(w)))) return 0.6;
  return 0;
}

function findColumns(q: string, tables: DataTable[], pred: (p: { isMetric: boolean; isCategory: boolean; isDate: boolean }) => boolean): ColMatch[] {
  const out: ColMatch[] = [];
  for (const t of tables) {
    for (const p of t.profiles) {
      if (!pred(p)) continue;
      const s = columnScore(q, p.name);
      if (s > 0) out.push({ tableId: t.id, column: p.name, score: s });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

const AGG_PATTERNS: [RegExp, AggKind][] = [
  [/\b(average|avg|mean|per\s+\w+\s+average)\b/i, 'avg'],
  [/\b(median)\b/i, 'median'],
  [/\b(how many|count|number of|no\. of)\b/i, 'count'],
  [/\b(unique|distinct|different)\b/i, 'distinct'],
  [/\b(max|maximum|highest|largest|biggest|peak)\b/i, 'max'],
  [/\b(min|minimum|lowest|smallest)\b/i, 'min'],
  [/\b(total|sum|overall|altogether)\b/i, 'sum'],
];

function detectAgg(q: string): AggKind | null {
  for (const [re, agg] of AGG_PATTERNS) if (re.test(q)) return agg;
  return null;
}

function detectGrain(q: string): TimeGrain | null {
  if (/\b(daily|by day|per day|day wise|daywise)\b/i.test(q)) return 'day';
  if (/\b(weekly|by week|per week|week wise)\b/i.test(q)) return 'week';
  if (/\b(monthly|by month|per month|month wise|month on month|mom)\b/i.test(q)) return 'month';
  if (/\b(quarterly|by quarter|per quarter|qoq)\b/i.test(q)) return 'quarter';
  if (/\b(yearly|annual|by year|per year|year wise|yoy|year on year)\b/i.test(q)) return 'year';
  if (/\b(trend|over time|timeline|growth|history)\b/i.test(q)) return 'month';
  return null;
}

function detectTopN(q: string): { n: number; dir: 'desc' | 'asc' } | null {
  const m = /\b(top|best|highest|largest|bottom|worst|lowest)\s+(\d{1,3})?\b/i.exec(q);
  if (!m) return null;
  const desc = /top|best|highest|largest/i.test(m[1]);
  return { n: m[2] ? +m[2] : desc ? 10 : 5, dir: desc ? 'desc' : 'asc' };
}

interface DateRange { from?: string; to?: string; label: string; }

function detectDateRange(q: string, today: string): DateRange | null {
  const t = new Date(today + 'T00:00:00Z');
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const shift = (days: number) => iso(new Date(t.getTime() - days * 86400000));
  let m = /\blast\s+(\d{1,3})\s*(day|week|month|year)s?\b/i.exec(q);
  if (m) {
    const n = +m[1];
    const days = m[2].toLowerCase() === 'day' ? n : m[2].toLowerCase() === 'week' ? n * 7 : m[2].toLowerCase() === 'month' ? n * 30 : n * 365;
    return { from: shift(days), to: today, label: `last ${n} ${m[2]}${n > 1 ? 's' : ''}` };
  }
  if (/\bthis month\b/i.test(q)) return { from: today.slice(0, 8) + '01', to: today, label: 'this month' };
  if (/\blast month\b/i.test(q)) {
    const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
    const e = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
    return { from: iso(d), to: iso(e), label: 'last month' };
  }
  if (/\bthis year\b|\bytd\b/i.test(q)) return { from: `${t.getUTCFullYear()}-01-01`, to: today, label: 'this year' };
  if (/\blast year\b/i.test(q)) {
    const y = t.getUTCFullYear() - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` };
  }
  m = /\b(?:in|for|during)\s+(20\d{2})\b/i.exec(q);
  if (m) return { from: `${m[1]}-01-01`, to: `${m[1]}-12-31`, label: m[1] };
  m = /\bsince\s+(20\d{2}-\d{2}-\d{2}|20\d{2})\b/i.exec(q);
  if (m) return { from: m[1].length === 4 ? `${m[1]}-01-01` : m[1], label: `since ${m[1]}` };
  return null;
}

/** find literal category values mentioned in the question */
function detectValueFilters(q: string, t: DataTable): { filters: QueryFilter[]; labels: string[]; valueHits: string[] } {
  const nq = ` ${q.toLowerCase()} `;
  const filters: QueryFilter[] = [];
  const labels: string[] = [];
  const valueHits: string[] = [];
  for (let ci = 0; ci < t.columns.length; ci++) {
    const p = t.profiles[ci];
    if (!p.isCategory && !p.isId) continue;
    const candidates = (p.uniqueCount <= 200 ? uniqueValues(t, ci, 200) : (p.topValues ?? []).map((v) => v.value));
    let best: string | null = null;
    for (const v of candidates) {
      const lv = v.toLowerCase().trim();
      if (lv.length < 3) continue;
      if (nq.includes(` ${lv} `) || nq.includes(`${lv},`) || nq.includes(` ${lv}?`) || nq.endsWith(` ${lv}`)) {
        if (!best || lv.length > best.length) best = v;
      }
    }
    if (best) {
      filters.push({ column: t.columns[ci], op: 'eq', value: best });
      labels.push(`${t.columns[ci]} = ${best}`);
      valueHits.push(best.toLowerCase());
    }
  }
  return { filters, labels, valueHits };
}

function uniqueValues(t: DataTable, ci: number, cap: number): string[] {
  const s = new Set<string>();
  for (const r of t.rows) {
    const v = r[ci];
    if (v === null) continue;
    s.add(String(v));
    if (s.size >= cap) break;
  }
  return [...s];
}

/** "north vs south", "compare A and B" */
function detectVersus(q: string, t: DataTable): { column: string; a: string; b: string } | null {
  const m = /(\S[\w ]*?)\s+(?:vs\.?|versus)\s+([\w ]+\S)/i.exec(q) ||
    /compare\s+([\w ]+?)\s+(?:and|with|to)\s+([\w ]+\S)/i.exec(q);
  if (!m) return null;
  const a = m[1].trim().toLowerCase(), b = m[2].trim().toLowerCase();
  for (let ci = 0; ci < t.columns.length; ci++) {
    const p = t.profiles[ci];
    if (!p.isCategory) continue;
    const vals = uniqueValues(t, ci, 200).map((v) => v.toLowerCase());
    const av = vals.find((v) => a.endsWith(v) || v === a);
    const bv = vals.find((v) => b.startsWith(v) || v === b);
    if (av && bv && av !== bv) return { column: t.columns[ci], a: av, b: bv };
  }
  return null;
}

function pickTable(q: string, ctx: AnswerContext): DataTable {
  const tables = ctx.tables;
  if (tables.length === 1) return tables[0];
  let best: { t: DataTable; score: number } | null = null;
  for (const t of tables) {
    let score = 0;
    if (norm(q).includes(norm(t.name))) score += 1.5;
    for (const p of t.profiles) score += columnScore(q, p.name) * 0.5;
    const vf = detectValueFilters(q, t);
    score += vf.filters.length * 0.8;
    if (ctx.intent?.kpis.some((k) => k.ref.tableId === t.id)) score += 0.3;
    if (!best || score > best.score) best = { t, score };
  }
  return best!.t;
}

function widgetFor(type: WidgetType, title: string, subtitle: string, query: AnalyticsQuery, currency?: string): WidgetSpec {
  return {
    id: uid('w'), title, subtitle, type,
    size: type === 'kpi' ? 'sm' : type === 'table' ? 'xl' : 'md',
    query, format: { currency },
  };
}

export async function answer(question: string, ctx: AnswerContext): Promise<EngineAnswer> {
  const q = question.trim();
  const today = ctx.today ?? todayISO();
  if (!ctx.tables.length) {
    return { text: 'Upload a file (Excel, CSV, PDF, JSON or a web link) and I can start answering questions about it.', attachments: [], lowConfidence: false };
  }

  // meta questions
  if (/\b(what (data|tables|columns|fields)|describe|summary of (the |my )?data|what can (i|you)|help|data quality|how good is)\b/i.test(q)) {
    return metaAnswer(q, ctx);
  }

  const t = pickTable(q, ctx);
  const currency = ctx.intent?.currency;
  const metricMatches = findColumns(q, [t], (p) => p.isMetric);
  const catMatches = findColumns(q, [t], (p) => p.isCategory);
  const dateCol = ctx.intent?.dateColumn?.tableId === t.id
    ? ctx.intent.dateColumn.column
    : t.profiles.find((p) => p.isDate)?.name ?? null;

  const agg = detectAgg(q);
  const grain = detectGrain(q);
  const topN = detectTopN(q);
  const range = detectDateRange(q, today);
  const vf = detectValueFilters(q, t);
  const versus = detectVersus(q, t);
  const wantsShare = /\b(share|percentage|percent|%|distribution|split|breakdown|proportion|mix)\b/i.test(q);
  const wantsAging = /\b(aging|ageing|overdue|outstanding|how old|past due|pending since)\b/i.test(q);
  const wantsForecast = /\b(forecast|project(ion)?|predict|next \d+ (month|week|day)|expect)\b/i.test(q);
  const wantsPivot = /\bpivot\b/i.test(q);

  // resolve primary metric (default to intent KPI / biggest metric)
  const metric = metricMatches[0]?.column
    ?? ctx.intent?.kpis.find((k) => k.ref.tableId === t.id)?.ref.column
    ?? t.profiles.filter((p) => p.isMetric).sort((a, b) => Math.abs(b.sum ?? 0) - Math.abs(a.sum ?? 0))[0]?.name
    ?? null;

  // group-by: explicit "by X", else matched category not used as a filter value
  let groupBy: string | null = null;
  const byMatch = /\bby\s+([\w .]+?)(?:\s+(?:for|in|of|last|this|over|during|since)\b|[?.,]|$)/i.exec(q);
  if (byMatch) {
    const target = byMatch[1].trim();
    const cand = findColumns(target, [t], (p) => p.isCategory || p.isDate);
    if (cand[0]) groupBy = cand[0].column;
  }
  if (!groupBy && catMatches[0] && !vf.valueHits.length) groupBy = catMatches[0].column;
  if (!groupBy && (topN || wantsShare)) {
    groupBy = (ctx.intent?.compareBy?.tableId === t.id ? ctx.intent.compareBy.column : undefined)
      ?? t.profiles.find((p) => p.isCategory)?.name ?? null;
  }

  const filters: QueryFilter[] = [...vf.filters];
  if (range && dateCol) {
    if (range.from && range.to) filters.push({ column: dateCol, op: 'between', value: [range.from, range.to] });
    else if (range.from) filters.push({ column: dateCol, op: 'gte', value: range.from });
  }

  let confidence = 0;
  confidence += metricMatches.length ? 1 : 0;
  confidence += (agg || topN || grain || wantsShare || wantsAging || versus || wantsForecast) ? 1 : 0;
  confidence += vf.filters.length + (range ? 1 : 0) + (groupBy && byMatch ? 1 : 0);

  const attach = (w: WidgetSpec): ChatAttachment => ({
    kind: w.type === 'kpi' ? 'kpi' : w.type === 'table' ? 'table' : 'chart',
    widget: w,
    result: runQuery(w.query, ctx),
  });
  const filterNote = [...vf.labels, range?.label].filter(Boolean).join(', ');
  const suffix = filterNote ? ` (${filterNote})` : '';

  try {
    // ── aging ──
    if (wantsAging && dateCol && metric) {
      const buckets = ctx.intent?.agingBuckets?.length ? ctx.intent.agingBuckets : [30, 60, 90];
      const w = widgetFor('aging', `Aging of ${titleCase(metric)}`, `days since ${dateCol}${suffix}`, {
        tableId: t.id,
        metrics: [{ column: metric, agg: 'sum' }, { column: '*', agg: 'count', as: 'Items' }],
        filters, aging: { dateColumn: dateCol, buckets }, withShare: true,
      }, currency);
      const a = attach(w);
      const rows = a.result.table.rows;
      const oldest = rows[rows.length - 1];
      const text = rows.length
        ? `Here's the aging of ${titleCase(metric)} measured from ${dateCol}${suffix}. ${oldest && String(oldest[0]).includes('+') ? `${fmtNum(Number(oldest[1]), { currency })} (${oldest[3] ?? oldest[2]}%) is already ${oldest[0]} old.` : ''}`
        : `No dated rows found to age${suffix}.`;
      return { text, attachments: [a], lowConfidence: false };
    }

    // ── forecast ──
    if (wantsForecast && dateCol && metric) {
      return forecast(q, ctx, t, metric, dateCol, filters, currency);
    }

    // ── versus comparison ──
    if (versus && metric) {
      // value filters on the compared column would cancel the comparison — drop them
      const vsFilters = filters.filter((f) => f.column.toLowerCase() !== versus.column.toLowerCase());
      const w = widgetFor('bar', `${titleCase(metric)}: ${titleCase(versus.a)} vs ${titleCase(versus.b)}`, `grouped by ${versus.column}${suffix}`, {
        tableId: t.id, metrics: [{ column: metric, agg: agg && agg !== 'count' ? agg : 'sum' }],
        groupBy: [versus.column],
        filters: [...vsFilters, { column: versus.column, op: 'in', value: [versus.a, versus.b] }],
        withShare: true,
      }, currency);
      const a = attach(w);
      const r = a.result.table.rows;
      let text = `Comparison of ${titleCase(metric)} by ${versus.column}${suffix}.`;
      if (r.length >= 2) {
        const [x, y] = r;
        const ratio = Number(y[1]) ? round(Number(x[1]) / Number(y[1]), 2) : null;
        text = `${String(x[0])}: ${fmtNum(Number(x[1]), { currency })} vs ${String(y[0])}: ${fmtNum(Number(y[1]), { currency })}${ratio ? ` — ${String(x[0])} is ${ratio}× of ${String(y[0])}` : ''}${suffix}.`;
      }
      return { text, attachments: [a], lowConfidence: false };
    }

    // ── trend over time ──
    if (grain && metric && dateCol) {
      const w = widgetFor('line', `${titleCase(metric)} by ${grain}`, `from ${dateCol}${suffix}`, {
        tableId: t.id, metrics: [{ column: metric, agg: agg ?? 'sum' }],
        groupBy: [dateCol], timeGrain: grain, filters,
      }, currency);
      const a = attach(w);
      const rows = a.result.table.rows;
      let text = `${titleCase(metric)} by ${grain}${suffix}.`;
      if (rows.length >= 2) {
        const first = Number(rows[0][1] ?? 0), last = Number(rows[rows.length - 1][1] ?? 0);
        const change = first ? round(((last - first) / Math.abs(first)) * 100, 1) : null;
        text = `${titleCase(metric)} went from ${fmtNum(first, { currency })} (${rows[0][0]}) to ${fmtNum(last, { currency })} (${rows[rows.length - 1][0]})${change !== null ? ` — ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% over the period` : ''}${suffix}.`;
      }
      return { text, attachments: [a], lowConfidence: false };
    }

    // ── pivot ──
    if (wantsPivot && metric && catMatches.length >= 2) {
      const [c1, c2] = catMatches;
      const w = widgetFor('table', `${titleCase(metric)} — ${c1.column} × ${c2.column}`, `pivot${suffix}`, {
        tableId: t.id, metrics: [{ column: metric, agg: agg ?? 'sum' }],
        groupBy: [c1.column, c2.column], filters, limit: 200,
      }, currency);
      return { text: `Pivot of ${titleCase(metric)} by ${c1.column} and ${c2.column}${suffix}.`, attachments: [attach(w)], lowConfidence: false };
    }

    // ── grouped breakdown / top N / share ──
    if (groupBy && (metric || agg === 'count')) {
      const useAgg: AggKind = agg ?? 'sum';
      const metricsArr: { column: string; agg: AggKind; as?: string }[] = metric && useAgg !== 'count'
        ? [{ column: metric, agg: useAgg }]
        : [{ column: '*', agg: 'count', as: 'Count' }];
      const w = widgetFor(wantsShare ? 'donut' : 'bar',
        `${metric && useAgg !== 'count' ? `${titleCase(useAgg)} ${titleCase(metric)}` : 'Count'} by ${titleCase(groupBy)}`,
        `${topN ? `top ${topN.n}` : 'all values'}${suffix}`, {
          tableId: t.id, metrics: metricsArr, groupBy: [groupBy], filters,
          limit: topN?.n ?? 12,
          sort: topN ? { by: metricsArr[0].as ?? `${titleCase(useAgg)} ${metric}`, dir: topN.dir } : undefined,
          withShare: true,
        }, currency);
      // fix sort alias
      w.query.sort = topN ? { by: w.query.metrics[0].as ?? defaultAliasLocal(w.query.metrics[0].agg, w.query.metrics[0].column), dir: topN.dir } : undefined;
      const a = attach(w);
      const rows = a.result.table.rows;
      let text = `Breakdown by ${groupBy}${suffix}.`;
      if (rows.length) {
        const top = rows[0];
        const shareCol = a.result.table.columns.indexOf('% of total');
        text = `${topN ? `Top ${Math.min(topN.n, rows.length)} ` : ''}${titleCase(groupBy)} by ${metric ? titleCase(metric) : 'count'}${suffix}: ${String(top[0])} leads with ${fmtNum(Number(top[1]), { currency })}${shareCol > 0 && top[shareCol] !== null ? ` (${top[shareCol]}% of total)` : ''}.`;
      }
      return { text, attachments: [a], lowConfidence: false };
    }

    // ── single number (KPI) ──
    if (metric || agg) {
      const useAgg: AggKind = agg ?? 'sum';
      const metricsArr = metric && useAgg !== 'count'
        ? [{ column: metric, agg: useAgg }]
        : [{ column: '*', agg: 'count' as AggKind, as: 'Rows' }];
      const w = widgetFor('kpi',
        metric && useAgg !== 'count' ? `${titleCase(useAgg)} of ${titleCase(metric)}` : 'Row count',
        `${t.name}${suffix}`,
        { tableId: t.id, metrics: metricsArr, filters }, currency);
      const a = attach(w);
      const v = a.result.table.rows[0]?.[0];
      const text = metric && useAgg !== 'count'
        ? `${titleCase(useAgg === 'sum' ? 'total' : useAgg)} ${titleCase(metric)} is ${fmtNum(Number(v), { currency })}${suffix} — computed from ${a.result.meta.rowsScanned.toLocaleString()} rows of ${t.name}.`
        : `There are ${fmtNum(Number(v))} matching rows in ${t.name}${suffix}.`;
      return { text, attachments: [a], lowConfidence: confidence < 2 };
    }

    // ── fallback: filtered raw view ──
    const w = widgetFor('table', `${t.name} — matching rows`, suffix || 'first rows', {
      tableId: t.id, metrics: [], filters, limit: 15,
    });
    const a = attach(w);
    return {
      text: vf.filters.length
        ? `I found ${a.result.table.rows.length} matching rows in ${t.name}${suffix}. Ask me to total or chart any column.`
        : `I wasn't fully sure what to compute, so here's a look at ${t.name}. Try "total <column> by <category>", "trend monthly", "top 10 …", or "aging of …".`,
      attachments: [a],
      lowConfidence: true,
    };
  } catch (e) {
    return {
      text: `I couldn't compute that: ${e instanceof Error ? e.message : String(e)}. Try naming a column from your data.`,
      attachments: [], lowConfidence: true,
    };
  }
}

function defaultAliasLocal(agg: AggKind, column: string): string {
  const names: Record<AggKind, string> = {
    sum: 'Total', avg: 'Avg', count: 'Count of', min: 'Min', max: 'Max', median: 'Median', distinct: 'Unique',
  };
  return column === '*' ? 'Rows' : `${names[agg]} ${column}`;
}

function forecast(
  _q: string, ctx: EngineContext, t: DataTable, metric: string, dateCol: string,
  filters: QueryFilter[], currency?: string,
): EngineAnswer {
  const base = runQuery({
    tableId: t.id, metrics: [{ column: metric, agg: 'sum', as: 'v' }],
    groupBy: [dateCol], timeGrain: 'month', filters,
  }, ctx);
  const series = base.table.rows
    .map((r) => Number(r[1] ?? 0));
  if (series.length < 3) {
    return { text: `I need at least 3 months of history to forecast ${titleCase(metric)} — there are only ${series.length}.`, attachments: [], lowConfidence: true };
  }
  // ordinary least squares on (index, value)
  const n = series.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  series.forEach((y, x) => { sx += x; sy += y; sxx += x * x; sxy += x * y; });
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const intercept = sy / n - slope * (sx / n);
  const horizon = 3;
  const lastLabel = String(base.table.rows[n - 1][0]);
  const [ly, lm] = lastLabel.split('-').map(Number);
  const futureRows: (string | number)[][] = [];
  for (let i = 1; i <= horizon; i++) {
    const m = lm + i;
    const label = `${ly + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12) + 1).padStart(2, '0')} (est.)`;
    futureRows.push([label, Math.max(0, round(intercept + slope * (n - 1 + i), 2))]);
  }
  const w: WidgetSpec = {
    id: uid('w'), title: `${titleCase(metric)} — 3-month projection`,
    subtitle: 'linear estimate from monthly history', type: 'line', size: 'lg',
    query: { tableId: t.id, metrics: [{ column: metric, agg: 'sum', as: 'v' }], groupBy: [dateCol], timeGrain: 'month', filters },
    format: { currency },
  };
  const result = {
    ...base,
    table: { ...base.table, rows: [...base.table.rows, ...futureRows] as typeof base.table.rows },
  };
  const next = Number(futureRows[0][1]);
  return {
    text: `Based on the linear trend of the last ${n} months, ${titleCase(metric)} is heading for roughly ${fmtNum(next, { currency })} next month (${slope >= 0 ? 'growing' : 'declining'} ≈ ${fmtNum(Math.abs(slope), { currency })}/month). This is an estimate from past data, not a guarantee.`,
    attachments: [{ kind: 'chart', widget: w, result }],
    lowConfidence: false,
  };
}

function metaAnswer(q: string, ctx: AnswerContext): EngineAnswer {
  const { tables, relations } = ctx;
  if (/quality|how good/i.test(q)) {
    const lines = tables.map((t) => {
      const bad = t.profiles.filter((p) => p.nullCount / Math.max(1, t.rowCount) > 0.2);
      return `${t.name}: ${t.rowCount.toLocaleString()} rows, ${t.columns.length} columns${bad.length ? `, ${bad.length} column(s) with >20% blanks (${bad.map((b) => b.name).join(', ')})` : ', no major gaps'}`;
    });
    return { text: `Data quality check:\n${lines.map((l) => `• ${l}`).join('\n')}`, attachments: [], lowConfidence: false };
  }
  const lines = tables.map((t) => {
    const metrics = t.profiles.filter((p) => p.isMetric).map((p) => p.name).slice(0, 4);
    const cats = t.profiles.filter((p) => p.isCategory).map((p) => p.name).slice(0, 4);
    const dates = t.profiles.filter((p) => p.isDate).map((p) => p.name);
    return `• ${t.name}: ${t.rowCount.toLocaleString()} rows — numbers: ${metrics.join(', ') || '–'}; categories: ${cats.join(', ') || '–'}; dates: ${dates.join(', ') || '–'}`;
  });
  const rels = relations.length
    ? `\nConnections: ${relations.map((r) => `${tname(ctx, r.fromTableId)}.${r.fromColumn} → ${tname(ctx, r.toTableId)}.${r.toColumn} (${Math.round(r.matchRate * 100)}% match)`).join(' · ')}`
    : '';
  const sampleMetric = tables.flatMap((t) => t.profiles.filter((p) => p.isMetric).map((p) => ({ t, p })))[0];
  const sampleCat = tables.flatMap((t) => t.profiles.filter((p) => p.isCategory).map((p) => ({ t, p })))[0];
  const examples = [
    sampleMetric ? `"Total ${sampleMetric.p.name}${sampleCat ? ` by ${sampleCat.p.name}` : ''}"` : null,
    sampleMetric ? `"Monthly trend of ${sampleMetric.p.name}"` : null,
    sampleCat ? `"Top 10 ${sampleCat.p.name}"` : null,
    `"What's the aging of outstanding amounts?"`,
  ].filter(Boolean).join(', ');
  return {
    text: `Here's what you've loaded:\n${lines.join('\n')}${rels}\n\nTry asking: ${examples}`,
    attachments: [], lowConfidence: false,
  };
}

function tname(ctx: EngineContext, id: string): string {
  return ctx.tables.find((t) => t.id === id)?.name ?? '?';
}

/** compact factual brief for the cloud AI — aggregates only, never raw rows */
export function describeDataForAI(ctx: EngineContext, focusQuestion?: string): string {
  const parts: string[] = [];
  for (const t of ctx.tables.slice(0, 6)) {
    const cols = t.profiles.slice(0, 14).map((p) => {
      if (p.type === 'number') return `${p.name}(number, sum=${p.sum !== undefined ? round(p.sum, 1) : '?'}, avg=${p.mean !== undefined ? round(p.mean, 2) : '?'}, min=${p.min}, max=${p.max})`;
      if (p.type === 'date') return `${p.name}(date, ${p.min}→${p.max})`;
      if (p.isCategory) return `${p.name}(category: ${(p.topValues ?? []).slice(0, 5).map((v) => `${v.value}×${v.count}`).join(', ')})`;
      return `${p.name}(${p.type}${p.isId ? ', id' : ''})`;
    });
    parts.push(`TABLE ${t.name} — ${t.rowCount} rows\n  ${cols.join('\n  ')}`);
  }
  if (ctx.relations.length) {
    parts.push(`RELATIONS: ${ctx.relations.map((r) => `${tname(ctx, r.fromTableId)}.${r.fromColumn}→${tname(ctx, r.toTableId)}.${r.toColumn}(${r.kind},match ${Math.round(r.matchRate * 100)}%)`).join('; ')}`);
  }
  if (ctx.intent) {
    parts.push(`USER GOAL: ${ctx.intent.goal}${ctx.intent.agingBuckets ? `; aging buckets ${ctx.intent.agingBuckets.join('/')}` : ''}`);
  }
  if (focusQuestion) {
    // run up to 3 relevant aggregates as hard facts
    try {
      const t = ctx.tables[0];
      const pm = ctx.intent?.kpis[0]?.ref ?? (t.profiles.find((p) => p.isMetric) ? { tableId: t.id, column: t.profiles.find((p) => p.isMetric)!.name } : null);
      if (pm) {
        const tt = ctx.tables.find((x) => x.id === pm.tableId)!;
        const total = runQuery({ tableId: tt.id, metrics: [{ column: pm.column, agg: 'sum', as: 'v' }], filters: [] }, ctx);
        parts.push(`FACT: total ${pm.column} = ${total.table.rows[0]?.[0]}`);
        const cat = tt.profiles.find((p) => p.isCategory);
        if (cat) {
          const br = runQuery({ tableId: tt.id, metrics: [{ column: pm.column, agg: 'sum', as: 'v' }], groupBy: [cat.name], filters: [], limit: 5, withShare: true }, ctx);
          parts.push(`FACT: top ${cat.name}: ${br.table.rows.map((r) => `${r[0]}=${r[1]}(${r[2]}%)`).join(', ')}`);
        }
      }
    } catch { /* facts are best-effort */ }
  }
  return parts.join('\n').slice(0, 2500);
}
