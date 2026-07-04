// Dashboard auto-design: intent + schema → decision-ready dashboard specs.
import type {
  AnalysisIntent, ColumnRef, DashboardSpec, DataTable, Relation, WidgetSpec,
} from '../contracts/types';
import { categoryQuality } from './profile';
import { titleCase, uid } from './util';

function metricsOf(t: DataTable) { return t.profiles.filter((p) => p.isMetric); }
function categoriesOf(t: DataTable) {
  return t.profiles
    .filter((p) => p.isCategory)
    .sort((a, b) => categoryQuality(b, t.rowCount) - categoryQuality(a, t.rowCount));
}
function datesOf(t: DataTable) { return t.profiles.filter((p) => p.isDate); }

function primaryMetric(t: DataTable, intent: AnalysisIntent): string | null {
  const fromIntent = intent.kpis.find((k) => k.ref.tableId === t.id);
  if (fromIntent) return fromIntent.ref.column;
  const ms = metricsOf(t).sort((a, b) => Math.abs(b.sum ?? 0) - Math.abs(a.sum ?? 0));
  return ms[0]?.name ?? null;
}

function dateColumnFor(t: DataTable, intent: AnalysisIntent): string | null {
  if (intent.dateColumn?.tableId === t.id) return intent.dateColumn.column;
  return datesOf(t)[0]?.name ?? null;
}

function corr(t: DataTable, a: string, b: string): number {
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

export function buildDashboards(
  tables: DataTable[],
  relations: Relation[],
  intent: AnalysisIntent,
): DashboardSpec[] {
  const dashboards: DashboardSpec[] = [];
  const richTables = tables.filter((t) => t.rowCount > 0 && t.columns.length >= 2);

  for (const t of richTables) {
    const widgets: WidgetSpec[] = [];
    const pm = primaryMetric(t, intent);
    const dc = dateColumnFor(t, intent);
    const cats = categoriesOf(t);
    const compare =
      intent.compareBy?.tableId === t.id ? intent.compareBy.column : cats[0]?.name ?? null;
    const secondCat = cats.find((c) => c.name !== compare)?.name ?? null;

    // KPI row
    const kpiRefs = intent.kpis.filter((k) => k.ref.tableId === t.id).slice(0, 3);
    for (const k of kpiRefs) {
      widgets.push({
        id: uid('w'), title: `Total ${titleCase(k.ref.column)}`,
        subtitle: `across ${t.rowCount.toLocaleString()} rows`,
        type: 'kpi', size: 'sm',
        query: { tableId: t.id, metrics: [{ column: k.ref.column, agg: k.agg }], filters: [] },
        format: { currency: intent.currency },
      });
    }
    widgets.push({
      id: uid('w'), title: 'Records', subtitle: `rows in ${t.name}`,
      type: 'kpi', size: 'sm',
      query: { tableId: t.id, metrics: [{ column: '*', agg: 'count', as: 'Rows' }], filters: [] },
    });

    // trend over time
    if (pm && dc) {
      widgets.push({
        id: uid('w'), title: `${titleCase(pm)} over time`,
        subtitle: `monthly · from ${dc}`,
        type: 'line', size: 'lg',
        query: {
          tableId: t.id, metrics: [{ column: pm, agg: 'sum' }],
          groupBy: [dc], timeGrain: 'month', filters: [],
        },
        format: { currency: intent.currency },
      });
    }

    // top categories
    if (pm && compare) {
      widgets.push({
        id: uid('w'), title: `${titleCase(pm)} by ${titleCase(compare)}`,
        subtitle: 'top 10 · click a bar to filter everything',
        type: 'bar', size: 'md', drillFilterColumn: compare,
        query: {
          tableId: t.id, metrics: [{ column: pm, agg: 'sum' }],
          groupBy: [compare], filters: [], limit: 10,
        },
        format: { currency: intent.currency },
      });
    }
    if (pm && secondCat) {
      widgets.push({
        id: uid('w'), title: `Share by ${titleCase(secondCat)}`,
        subtitle: 'click a slice to filter everything',
        type: 'donut', size: 'md', drillFilterColumn: secondCat,
        query: {
          tableId: t.id, metrics: [{ column: pm, agg: 'sum' }],
          groupBy: [secondCat], filters: [], limit: 8, withShare: true,
        },
        format: { currency: intent.currency },
      });
    }

    // aging
    if (pm && dc && intent.agingBuckets?.length) {
      widgets.push({
        id: uid('w'), title: `Aging of ${titleCase(pm)}`,
        subtitle: `days since ${dc} · as of today`,
        type: 'aging', size: 'lg',
        query: {
          tableId: t.id,
          metrics: [{ column: pm, agg: 'sum' }, { column: '*', agg: 'count', as: 'Items' }],
          filters: [], aging: { dateColumn: dc, buckets: intent.agingBuckets },
          withShare: true,
        },
        format: { currency: intent.currency },
      });
    }

    // scatter when two metrics correlate
    const ms = metricsOf(t);
    if (ms.length >= 2) {
      let best: { a: string; b: string; r: number } | null = null;
      for (let i = 0; i < Math.min(ms.length, 4); i++) {
        for (let j = i + 1; j < Math.min(ms.length, 4); j++) {
          const r = Math.abs(corr(t, ms[i].name, ms[j].name));
          if (!best || r > best.r) best = { a: ms[i].name, b: ms[j].name, r };
        }
      }
      if (best && best.r >= 0.5 && compare) {
        widgets.push({
          id: uid('w'), title: `${titleCase(best.a)} vs ${titleCase(best.b)}`,
          subtitle: `relationship strength ${(best.r * 100).toFixed(0)}%`,
          type: 'scatter', size: 'md',
          query: {
            tableId: t.id,
            metrics: [{ column: best.a, agg: 'sum' }, { column: best.b, agg: 'sum' }],
            groupBy: [compare], filters: [], limit: 50,
          },
        });
      }
    }

    // detail table
    if (pm) {
      widgets.push({
        id: uid('w'), title: `${t.name} — detail`,
        subtitle: `top rows by ${pm}`,
        type: 'table', size: 'xl',
        query: {
          tableId: t.id, metrics: [], filters: [],
          sort: { by: pm, dir: 'desc' }, limit: 25,
        },
      });
    } else {
      widgets.push({
        id: uid('w'), title: `${t.name} — sample`, subtitle: 'first 25 rows',
        type: 'table', size: 'xl',
        query: { tableId: t.id, metrics: [], filters: [], limit: 25 },
      });
    }

    const globalFilterColumns: ColumnRef[] = intent.filterColumns.filter(
      (f) => f.tableId === t.id,
    );
    if (!globalFilterColumns.length) {
      globalFilterColumns.push(
        ...cats.slice(0, 3).map((c) => ({ tableId: t.id, column: c.name })),
      );
    }

    dashboards.push({
      id: uid('d'),
      name: titleCase(t.name),
      description: `${intent.goal} — built from ${t.rowCount.toLocaleString()} rows of ${t.name}.`,
      tableIds: [t.id],
      globalFilterColumns,
      dateColumn: dc ? { tableId: t.id, column: dc } : undefined,
      widgets,
    });
  }

  // overview when several tables are related
  if (richTables.length >= 2 && relations.length) {
    const widgets: WidgetSpec[] = [];
    for (const t of richTables) {
      const pm = primaryMetric(t, intent);
      if (!pm) continue;
      widgets.push({
        id: uid('w'), title: `${titleCase(pm)} — ${t.name}`,
        subtitle: `${t.rowCount.toLocaleString()} rows`,
        type: 'kpi', size: 'sm',
        query: { tableId: t.id, metrics: [{ column: pm, agg: 'sum' }], filters: [] },
        format: { currency: intent.currency },
      });
      if (widgets.length >= 4) break;
    }
    dashboards.unshift({
      id: uid('d'),
      name: 'Overview',
      description: `How your ${richTables.length} tables connect: ${relations
        .map((r) => `${tableNameOf(tables, r.fromTableId)}.${r.fromColumn} → ${tableNameOf(tables, r.toTableId)}.${r.toColumn}`)
        .join(' · ')}`,
      tableIds: richTables.map((t) => t.id),
      globalFilterColumns: intent.filterColumns,
      dateColumn: intent.dateColumn,
      widgets,
    });
  }
  return dashboards;
}

function tableNameOf(tables: DataTable[], id: string): string {
  return tables.find((t) => t.id === id)?.name ?? '?';
}
