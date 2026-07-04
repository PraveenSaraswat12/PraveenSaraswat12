// Automated findings: real computed observations, ranked by severity.
import type {
  AnalysisIntent, DataTable, Insight, Relation, WidgetSpec,
} from '../contracts/types';
import type { EngineContext } from '../contracts/modules';
import { categoryQuality } from './profile';
import { runQuery, truncateDate } from './query';
import { fmtNum, round, titleCase, uid } from './util';

const SEV_ORDER = { critical: 0, warn: 1, good: 2, info: 3 } as const;

export function generateInsights(
  tables: DataTable[],
  relations: Relation[],
  intent?: AnalysisIntent,
): Insight[] {
  const ctx: EngineContext = { tables, relations, intent };
  const out: Insight[] = [];
  for (const t of tables) {
    if (!t.rowCount) continue;
    const pm = primaryMetric(t, intent);
    const dc = intent?.dateColumn?.tableId === t.id
      ? intent.dateColumn.column
      : t.profiles.find((p) => p.isDate)?.name;
    const cat = intent?.compareBy?.tableId === t.id
      ? intent.compareBy.column
      : [...t.profiles]
          .filter((p) => p.isCategory)
          .sort((a, b) => categoryQuality(b, t.rowCount) - categoryQuality(a, t.rowCount))[0]?.name;
    const cur = intent?.currency;

    if (pm && dc) trend(out, ctx, t.id, t.name, pm, dc, cur);
    if (pm && cat) { concentration(out, ctx, t.id, t.name, pm, cat, cur); bestWorst(out, ctx, t.id, pm, cat); }
    if (pm) outliers(out, t, pm);
    quality(out, t);
    if (pm && dc && intent?.agingBuckets?.length) aging(out, ctx, t.id, pm, dc, intent.agingBuckets, cur);
    correlation(out, t);
  }
  return out
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
    .slice(0, 10);
}

function primaryMetric(t: DataTable, intent?: AnalysisIntent): string | null {
  const k = intent?.kpis.find((x) => x.ref.tableId === t.id);
  if (k) return k.ref.column;
  const ms = t.profiles.filter((p) => p.isMetric).sort((a, b) => Math.abs(b.sum ?? 0) - Math.abs(a.sum ?? 0));
  return ms[0]?.name ?? null;
}

function add(out: Insight[], i: Omit<Insight, 'id'>) { out.push({ id: uid('i'), ...i }); }

function trend(out: Insight[], ctx: EngineContext, tableId: string, tname: string, pm: string, dc: string, cur?: string) {
  const r = runQuery(
    { tableId, metrics: [{ column: pm, agg: 'sum', as: 'v' }], groupBy: [dc], timeGrain: 'month', filters: [] },
    ctx,
  );
  const rows = r.table.rows;
  if (rows.length < 2) return;
  const last = rows[rows.length - 1], prev = rows[rows.length - 2];
  const lv = Number(last[1] ?? 0), pv = Number(prev[1] ?? 0);
  if (!pv) return;
  const change = round(((lv - pv) / Math.abs(pv)) * 100, 1);
  if (Math.abs(change) < 5) return;
  const up = change > 0;
  add(out, {
    tableId, kind: 'trend',
    severity: Math.abs(change) > 25 ? (up ? 'good' : 'critical') : up ? 'good' : 'warn',
    title: `${titleCase(pm)} ${up ? 'up' : 'down'} ${Math.abs(change)}% in ${last[0]}`,
    detail: `${last[0]}: ${fmtNum(lv, { currency: cur })} vs ${prev[0]}: ${fmtNum(pv, { currency: cur })} in ${tname}.`,
    widget: {
      id: uid('w'), title: `${titleCase(pm)} monthly`, type: 'line', size: 'md',
      query: { tableId, metrics: [{ column: pm, agg: 'sum' }], groupBy: [dc], timeGrain: 'month', filters: [] },
      format: { currency: cur },
    },
  });
}

function concentration(out: Insight[], ctx: EngineContext, tableId: string, tname: string, pm: string, cat: string, cur?: string) {
  const r = runQuery(
    { tableId, metrics: [{ column: pm, agg: 'sum', as: 'v' }], groupBy: [cat], filters: [], withShare: true },
    ctx,
  );
  const top = r.table.rows[0];
  if (!top) return;
  const share = Number(top[2] ?? 0);
  if (share < 40) return;
  add(out, {
    tableId, kind: 'concentration',
    severity: share > 60 ? 'warn' : 'info',
    title: `${String(top[0])} drives ${share}% of ${titleCase(pm)}`,
    detail: `One ${titleCase(cat).toLowerCase()} contributes ${fmtNum(Number(top[1]), { currency: cur })} of the ${titleCase(pm).toLowerCase()} in ${tname}. ${share > 60 ? 'That is a real dependency risk.' : 'Worth watching.'}`,
    widget: {
      id: uid('w'), title: `${titleCase(pm)} by ${titleCase(cat)}`, type: 'donut', size: 'md',
      query: { tableId, metrics: [{ column: pm, agg: 'sum' }], groupBy: [cat], filters: [], limit: 8, withShare: true },
      format: { currency: cur },
    },
  });
}

function bestWorst(out: Insight[], ctx: EngineContext, tableId: string, pm: string, cat: string) {
  const r = runQuery(
    { tableId, metrics: [{ column: pm, agg: 'sum', as: 'v' }], groupBy: [cat], filters: [] },
    ctx,
  );
  const rows = r.table.rows.filter((x) => typeof x[1] === 'number' && (x[1] as number) > 0);
  if (rows.length < 3) return;
  const best = rows[0], worst = rows[rows.length - 1];
  const ratio = (best[1] as number) / Math.max(1e-9, worst[1] as number);
  if (ratio < 2.5) return;
  add(out, {
    tableId, kind: 'comparison', severity: 'info',
    title: `${String(best[0])} outperforms ${String(worst[0])} ${round(ratio, 1)}×`,
    detail: `${titleCase(pm)} for ${String(best[0])} is ${fmtNum(best[1] as number)} vs ${fmtNum(worst[1] as number)} for ${String(worst[0])} (${titleCase(cat)}).`,
  });
}

function outliers(out: Insight[], t: DataTable, pm: string) {
  const p = t.profiles.find((x) => x.name === pm);
  if (!p || p.stdDev === undefined || p.mean === undefined || !p.stdDev) return;
  const ci = t.columns.indexOf(pm);
  let count = 0; let extreme = 0;
  for (const r of t.rows) {
    const v = r[ci];
    if (typeof v !== 'number') continue;
    const z = Math.abs((v - p.mean) / p.stdDev);
    if (z > 3) { count++; if (Math.abs(v) > Math.abs(extreme)) extreme = v; }
  }
  if (!count) return;
  add(out, {
    tableId: t.id, kind: 'outlier', severity: count > t.rowCount * 0.02 ? 'warn' : 'info',
    title: `${count} unusual ${titleCase(pm)} value${count > 1 ? 's' : ''}`,
    detail: `${count} row${count > 1 ? 's' : ''} sit far outside the normal range (most extreme: ${fmtNum(extreme)} vs average ${fmtNum(p.mean)}). Check for data-entry errors or genuinely exceptional records.`,
  });
}

function quality(out: Insight[], t: DataTable) {
  const bad = t.profiles.filter((p) => p.nullCount / Math.max(1, t.rowCount) > 0.2 && p.type !== 'empty');
  if (bad.length) {
    add(out, {
      tableId: t.id, kind: 'quality', severity: 'warn',
      title: `${bad.length} column${bad.length > 1 ? 's' : ''} with many blanks in ${t.name}`,
      detail: bad.slice(0, 3).map((p) => `${p.name}: ${round((100 * p.nullCount) / t.rowCount, 0)}% empty`).join(' · ') +
        '. Charts using these fields may undercount.',
    });
  }
  // duplicate rows
  const seen = new Set<string>(); let dupes = 0;
  for (const r of t.rows) {
    const k = r.map(String).join('¦');
    if (seen.has(k)) dupes++; else seen.add(k);
    if (seen.size > 50000) return; // cap cost
  }
  if (dupes > 0) {
    add(out, {
      tableId: t.id, kind: 'quality', severity: dupes > t.rowCount * 0.05 ? 'warn' : 'info',
      title: `${dupes} duplicated row${dupes > 1 ? 's' : ''} in ${t.name}`,
      detail: 'Exact copies were found — totals may be inflated. Consider de-duplicating at the source.',
    });
  }
}

function aging(out: Insight[], ctx: EngineContext, tableId: string, pm: string, dc: string, buckets: number[], cur?: string) {
  const r = runQuery(
    {
      tableId, metrics: [{ column: pm, agg: 'sum', as: 'v' }], filters: [],
      aging: { dateColumn: dc, buckets }, withShare: true,
    },
    ctx,
  );
  const oldest = r.table.rows[r.table.rows.length - 1];
  if (!oldest || !String(oldest[0]).includes('+')) return;
  const share = Number(oldest[2] ?? 0);
  if (share < 10) return;
  add(out, {
    tableId, kind: 'aging',
    severity: share > 25 ? 'critical' : 'warn',
    title: `${share}% of ${titleCase(pm)} is ${String(oldest[0])} old`,
    detail: `${fmtNum(Number(oldest[1]), { currency: cur })} has aged past ${buckets[buckets.length - 1]} days (measured from ${dc}). ${share > 25 ? 'This needs follow-up now.' : 'Keep an eye on it.'}`,
    widget: {
      id: uid('w'), title: `Aging of ${titleCase(pm)}`, type: 'aging', size: 'md',
      query: {
        tableId, metrics: [{ column: pm, agg: 'sum' }], filters: [],
        aging: { dateColumn: dc, buckets }, withShare: true,
      },
      format: { currency: cur },
    },
  });
}

function correlation(out: Insight[], t: DataTable) {
  const ms = t.profiles.filter((p) => p.isMetric).slice(0, 4);
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      const r = pearson(t, ms[i].name, ms[j].name);
      if (Math.abs(r) < 0.7) continue;
      add(out, {
        tableId: t.id, kind: 'correlation', severity: 'info',
        title: `${titleCase(ms[i].name)} moves with ${titleCase(ms[j].name)}`,
        detail: `Correlation ${round(r, 2)} — when one ${r > 0 ? 'rises, so does' : 'rises,'} the other${r > 0 ? '' : ' falls'}. Useful for forecasting one from the other.`,
      });
      return; // one per table is enough
    }
  }
}

function pearson(t: DataTable, a: string, b: string): number {
  const ai = t.columns.indexOf(a), bi = t.columns.indexOf(b);
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (const r of t.rows) {
    const x = r[ai], y = r[bi];
    if (typeof x !== 'number' || typeof y !== 'number') continue;
    n++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
  }
  if (n < 8) return 0;
  const cov = sab / n - (sa / n) * (sb / n);
  const va = saa / n - (sa / n) ** 2;
  const vb = sbb / n - (sb / n) ** 2;
  if (va <= 0 || vb <= 0) return 0;
  return cov / Math.sqrt(va * vb);
}

export { truncateDate };
