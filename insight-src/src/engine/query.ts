// The analytics core: filters → aging/grouping → aggregation → share/sort/limit.
import type {
  AggKind, AnalyticsQuery, Cell, ColumnType, DataTable, QueryFilter,
  QueryResult, Row, TimeGrain,
} from '../contracts/types';
import type { EngineContext } from '../contracts/modules';
import { isoToMs, parseDateLoose, round, todayISO } from './util';

export function getTable(ctx: EngineContext, tableId: string): DataTable {
  const t = ctx.tables.find((x) => x.id === tableId);
  if (!t) throw new Error('That table is no longer loaded.');
  return t;
}

function colIndex(t: DataTable, name: string): number {
  const i = t.columns.indexOf(name);
  if (i < 0) {
    const j = t.columns.findIndex((c) => c.toLowerCase() === name.toLowerCase());
    if (j >= 0) return j;
    throw new Error(`Column "${name}" was not found in ${t.name}.`);
  }
  return i;
}

// ── filtering ────────────────────────────────────────────────────────────────

function normFilterValue(t: DataTable, ci: number, v: Cell): Cell {
  const prof = t.profiles[ci];
  if (prof?.type === 'date' && typeof v === 'string') {
    const d = parseDateLoose(v, true);
    return d ? d.iso : v;
  }
  if (prof?.type === 'number' && typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}

export function rowPasses(t: DataTable, row: Row, f: QueryFilter, ci: number): boolean {
  const cell = row[ci];
  const isArr = Array.isArray(f.value);
  const fv = isArr ? null : normFilterValue(t, ci, f.value as Cell);
  switch (f.op) {
    case 'eq':
      if (cell === null) return fv === null;
      if (typeof cell === 'string' && typeof fv === 'string') return cell.toLowerCase() === fv.toLowerCase();
      return cell === fv;
    case 'neq':
      if (typeof cell === 'string' && typeof fv === 'string') return cell.toLowerCase() !== fv.toLowerCase();
      return cell !== fv;
    case 'contains':
      return cell !== null && String(cell).toLowerCase().includes(String(fv ?? '').toLowerCase());
    case 'in': {
      const arr = (Array.isArray(f.value) ? f.value : [f.value]).map((v) => normFilterValue(t, ci, v));
      return arr.some((v) =>
        typeof cell === 'string' && typeof v === 'string'
          ? cell.toLowerCase() === v.toLowerCase()
          : cell === v);
    }
    case 'gt': return cmp(cell, fv) > 0;
    case 'gte': return cmp(cell, fv) >= 0;
    case 'lt': return cmp(cell, fv) < 0;
    case 'lte': return cmp(cell, fv) <= 0;
    case 'after': return cmp(cell, fv) > 0;
    case 'before': return cmp(cell, fv) < 0;
    case 'between': {
      const [a, b] = (f.value as Cell[]).map((v) => normFilterValue(t, ci, v));
      return cmp(cell, a) >= 0 && cmp(cell, b) <= 0;
    }
    default: return true;
  }
}

function cmp(a: Cell, b: Cell): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? -1 : 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export function applyFilters(t: DataTable, rows: Row[], filters: QueryFilter[]): Row[] {
  if (!filters.length) return rows;
  const resolved = filters.map((f) => ({ f, ci: colIndex(t, f.column) }));
  return rows.filter((r) => resolved.every(({ f, ci }) => rowPasses(t, r, f, ci)));
}

// ── time + aging keys ────────────────────────────────────────────────────────

export function truncateDate(iso: string, grain: TimeGrain): string {
  const y = iso.slice(0, 4), m = iso.slice(5, 7), d = iso.slice(8, 10);
  switch (grain) {
    case 'day': return iso.slice(0, 10);
    case 'month': return `${y}-${m}`;
    case 'year': return y;
    case 'quarter': return `${y}-Q${Math.floor((Number(m) - 1) / 3) + 1}`;
    case 'week': {
      const dt = new Date(Date.UTC(+y, +m - 1, +d));
      const day = (dt.getUTCDay() + 6) % 7;
      dt.setUTCDate(dt.getUTCDate() - day + 3);
      const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
      const fday = (firstThu.getUTCDay() + 6) % 7;
      firstThu.setUTCDate(firstThu.getUTCDate() - fday + 3);
      const week = 1 + Math.round((dt.getTime() - firstThu.getTime()) / (7 * 86400000));
      return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
    }
  }
}

export function agingBucketLabels(buckets: number[]): string[] {
  const b = [...buckets].sort((x, y) => x - y);
  const labels: string[] = [];
  let prev = 0;
  for (const upper of b) {
    labels.push(prev === 0 ? `0–${upper} days` : `${prev + 1}–${upper} days`);
    prev = upper;
  }
  labels.push(`${prev}+ days`);
  return labels;
}

function agingLabel(ageDays: number, buckets: number[], labels: string[]): string {
  if (ageDays < 0) return 'Not due';
  for (let i = 0; i < buckets.length; i++) {
    if (ageDays <= buckets[i]) return labels[i];
  }
  return labels[labels.length - 1];
}

// ── aggregation ──────────────────────────────────────────────────────────────

interface Acc { sum: number; count: number; min: number; max: number; values?: number[]; set?: Set<string>; }

function newAcc(kind: AggKind): Acc {
  return {
    sum: 0, count: 0, min: Infinity, max: -Infinity,
    values: kind === 'median' ? [] : undefined,
    set: kind === 'distinct' ? new Set() : undefined,
  };
}

function feed(acc: Acc, kind: AggKind, v: Cell) {
  if (kind === 'count') { if (v !== null) acc.count++; return; }
  if (kind === 'distinct') { if (v !== null) acc.set!.add(String(v)); return; }
  if (typeof v !== 'number' || !Number.isFinite(v)) return;
  acc.count++;
  acc.sum += v;
  if (v < acc.min) acc.min = v;
  if (v > acc.max) acc.max = v;
  acc.values?.push(v);
}

function finish(acc: Acc, kind: AggKind): number | null {
  switch (kind) {
    case 'sum': return acc.count ? round(acc.sum, 4) : null;
    case 'avg': return acc.count ? round(acc.sum / acc.count, 4) : null;
    case 'count': return acc.count;
    case 'distinct': return acc.set!.size;
    case 'min': return acc.count ? acc.min : null;
    case 'max': return acc.count ? acc.max : null;
    case 'median': {
      const v = acc.values!;
      if (!v.length) return null;
      v.sort((a, b) => a - b);
      const mid = Math.floor(v.length / 2);
      return v.length % 2 ? v[mid] : round((v[mid - 1] + v[mid]) / 2, 4);
    }
  }
}

export function defaultAlias(agg: AggKind, column: string): string {
  const names: Record<AggKind, string> = {
    sum: 'Total', avg: 'Avg', count: 'Count of', min: 'Min', max: 'Max',
    median: 'Median', distinct: 'Unique',
  };
  return column === '*' ? 'Rows' : `${names[agg]} ${column}`;
}

// ── the main entry ───────────────────────────────────────────────────────────

export function runQuery(q: AnalyticsQuery, ctx: EngineContext): QueryResult {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const t = getTable(ctx, q.tableId);
  const filtered = applyFilters(t, t.rows, q.filters || []);

  const metrics = (q.metrics || []).map((m) => ({
    ...m,
    as: m.as || defaultAlias(m.agg, m.column),
    ci: m.column === '*' ? -1 : colIndex(t, m.column),
  }));

  let columns: string[] = [];
  let types: ColumnType[] = [];
  let rows: Row[] = [];
  let totals: Row | undefined;

  const grouping = q.aging || (q.groupBy && q.groupBy.length);

  if (q.aging) {
    const dci = colIndex(t, q.aging.dateColumn);
    const buckets = [...q.aging.buckets].sort((a, b) => a - b);
    const labels = agingBucketLabels(buckets);
    const asOfMs = isoToMs(q.aging.asOf || todayISO());
    const groups = new Map<string, Acc[]>();
    const order = ['Not due', ...labels];
    for (const r of filtered) {
      const iso = r[dci];
      if (typeof iso !== 'string') continue;
      const ms = isoToMs(iso);
      if (!Number.isFinite(ms)) continue;
      const age = Math.floor((asOfMs - ms) / 86400000);
      const label = agingLabel(age, buckets, labels);
      let accs = groups.get(label);
      if (!accs) { accs = metrics.map((m) => newAcc(m.agg)); groups.set(label, accs); }
      metrics.forEach((m, i) => feed(accs![i], m.agg, m.ci < 0 ? 1 : r[m.ci]));
    }
    columns = ['Age', ...metrics.map((m) => m.as!)];
    types = ['string', ...metrics.map(() => 'number' as ColumnType)];
    rows = order
      .filter((l) => groups.has(l))
      .map((l) => [l, ...groups.get(l)!.map((acc, i) => finish(acc, metrics[i].agg))]);
  } else if (q.groupBy && q.groupBy.length) {
    const gcis = q.groupBy.map((g) => colIndex(t, g));
    const dateCols = gcis.map((ci) => t.profiles[ci]?.type === 'date');
    const groups = new Map<string, { keys: Cell[]; accs: Acc[] }>();
    for (const r of filtered) {
      const keys = gcis.map((ci, gi) => {
        const v = r[ci];
        if (dateCols[gi] && q.timeGrain && typeof v === 'string') return truncateDate(v, q.timeGrain);
        return v === null ? '(blank)' : v;
      });
      const key = keys.map(String).join('¦');
      let g = groups.get(key);
      if (!g) { g = { keys, accs: metrics.map((m) => newAcc(m.agg)) }; groups.set(key, g); }
      metrics.forEach((m, i) => feed(g!.accs[i], m.agg, m.ci < 0 ? 1 : r[m.ci]));
    }
    columns = [...q.groupBy, ...metrics.map((m) => m.as!)];
    types = [
      ...gcis.map((ci, gi) => (dateCols[gi] && q.timeGrain ? 'string' : t.profiles[ci]?.type ?? 'string') as ColumnType),
      ...metrics.map(() => 'number' as ColumnType),
    ];
    rows = [...groups.values()].map((g) => [...g.keys, ...g.accs.map((a, i) => finish(a, metrics[i].agg))]);
    // time series sort ascending by the date key by default
    if (q.timeGrain && !q.sort) rows.sort((a, b) => String(a[0]) < String(b[0]) ? -1 : 1);
  } else if (metrics.length) {
    const accs = metrics.map((m) => newAcc(m.agg));
    for (const r of filtered) metrics.forEach((m, i) => feed(accs[i], m.agg, m.ci < 0 ? 1 : r[m.ci]));
    columns = metrics.map((m) => m.as!);
    types = metrics.map(() => 'number');
    rows = [metrics.map((m, i) => finish(accs[i], m.agg))];
  } else {
    // raw rows
    columns = t.columns.slice();
    types = t.profiles.map((p) => p.type);
    rows = filtered.slice();
  }

  // share column
  if (q.withShare && grouping && metrics.length && rows.length) {
    const mi = columns.length - metrics.length; // first metric col index
    const total = rows.reduce((a, r) => a + (typeof r[mi] === 'number' ? (r[mi] as number) : 0), 0);
    columns = [...columns, '% of total'];
    types = [...types, 'number'];
    rows = rows.map((r) => [...r, total ? round((100 * ((r[mi] as number) || 0)) / total, 1) : null]);
  }

  // sort
  const metricStart = grouping ? columns.length - metrics.length - (q.withShare ? 1 : 0) : 0;
  if (q.sort) {
    const si = columns.findIndex((c) => c.toLowerCase() === q.sort!.by.toLowerCase());
    if (si >= 0) {
      const dir = q.sort.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => dir * cmp(a[si], b[si]));
    }
  } else if (grouping && !q.aging && !q.timeGrain && metrics.length) {
    rows.sort((a, b) => cmp(b[metricStart], a[metricStart])); // first metric desc
  }

  // totals (before limit, over all groups)
  if (grouping && metrics.length && rows.length > 1) {
    totals = new Array(columns.length).fill(null);
    totals[0] = 'Total';
    metrics.forEach((m, i) => {
      const ci = metricStart + i;
      if (m.agg === 'sum' || m.agg === 'count') {
        totals![ci] = round(rows.reduce((a, r) => a + ((r[ci] as number) || 0), 0), 4);
      } else if (m.agg === 'avg') {
        const acc = newAcc('avg');
        for (const r of filtered) feed(acc, 'avg', m.ci < 0 ? 1 : r[m.ci]);
        totals![ci] = finish(acc, 'avg');
      } else if (m.agg === 'min' || m.agg === 'max') {
        const vals = rows.map((r) => r[ci]).filter((v): v is number => typeof v === 'number');
        totals![ci] = vals.length ? (m.agg === 'min' ? Math.min(...vals) : Math.max(...vals)) : null;
      }
    });
    if (q.withShare) totals[columns.length - 1] = 100;
  }

  // limit
  const limit = q.limit ?? (grouping ? 500 : 100);
  if (rows.length > limit) rows = rows.slice(0, limit);

  const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  return {
    table: { columns, types, rows },
    totals,
    meta: {
      tableId: q.tableId,
      appliedFilters: q.filters || [],
      ms: Math.round((t1 - t0) * 10) / 10,
      rowsScanned: t.rows.length,
    },
  };
}
