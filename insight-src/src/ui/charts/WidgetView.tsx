// Renders any WidgetSpec + QueryResult: charts (Chart.js), KPI cards, tables.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'chart.js/auto';
import type { QueryResult, WidgetSpec } from '../../contracts/types';
import { fmtNum } from '../../engine';
import { cx } from '../components';

export const PALETTE = ['#3a6df4', '#7c4dff', '#19c9a6', '#ffb454', '#ff6b8b', '#8e93b8', '#5ad1e6', '#c0a062'];
const AGING_COLORS = ['#19c9a6', '#3a6df4', '#ffb454', '#ff8a5c', '#ff6b8b'];

const GRID = 'rgba(255,255,255,0.05)';
const TICK = '#8e93b8';

function fmtCell(v: unknown, opts: { currency?: string; decimals?: number } = {}, percentCol = false): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return percentCol ? `${v}%` : fmtNum(v, opts);
  return String(v);
}

export function WidgetView({
  widget, result, error, onSlice, height,
}: {
  widget: WidgetSpec;
  result: QueryResult | null;
  error?: string;
  onSlice?: (label: string) => void;
  height?: number;
}) {
  if (error) {
    return (
      <div className="h-full grid place-items-center p-6 text-center">
        <p className="text-xs text-rosex-400">{error}</p>
      </div>
    );
  }
  if (!result || !result.table.rows.length) {
    return (
      <div className="h-full grid place-items-center p-6 text-center">
        <p className="text-xs text-mist-500">No data for this view yet — adjust filters or add more data.</p>
      </div>
    );
  }
  switch (widget.type) {
    case 'kpi': return <KpiView widget={widget} result={result} />;
    case 'table': return <TableView widget={widget} result={result} />;
    case 'aging': return <AgingView widget={widget} result={result} onSlice={onSlice} height={height} />;
    default: return <ChartView widget={widget} result={result} onSlice={onSlice} height={height} />;
  }
}

function KpiView({ widget, result }: { widget: WidgetSpec; result: QueryResult }) {
  const v = result.table.rows[0]?.[0];
  return (
    <div className="px-4 py-2">
      <div className="font-display text-3xl text-mist-50 num leading-tight">
        {fmtCell(v, { currency: widget.format?.currency })}
      </div>
    </div>
  );
}

const SIZE_H: Record<string, number> = { sm: 96, md: 260, lg: 300, xl: 320 };

function ChartView({
  widget, result, onSlice, height,
}: { widget: WidgetSpec; result: QueryResult; onSlice?: (l: string) => void; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const h = height ?? SIZE_H[widget.size] ?? 260;

  const { labels, datasets, type } = useMemo(() => buildChartData(widget, result), [widget, result]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    chartRef.current?.destroy();
    const isPie = type === 'pie' || type === 'doughnut';
    const chart = new Chart(canvas, {
      type: type as any,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: import.meta.env.MODE === 'test' ? false : { duration: 350 },
        onClick: (_e: unknown, els: { index: number }[]) => {
          if (!onSlice || !widget.drillFilterColumn || !els.length) return;
          const i = els[0].index;
          onSlice(String(labels[i]));
        },
        plugins: {
          legend: isPie
            ? { position: 'right', labels: { color: TICK, boxWidth: 10, font: { size: 11 } } }
            : datasets.length > 1
              ? { position: 'top', labels: { color: TICK, boxWidth: 10, font: { size: 11 } } }
              : { display: false },
          tooltip: {
            backgroundColor: '#1a1e3a', titleColor: '#f4f1ea', bodyColor: '#b8bdd9',
            borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, padding: 10,
            callbacks: {
              label: (c: any) => {
                const v = typeof c.raw === 'object' && c.raw ? (c.raw as any).y : c.raw;
                return ` ${c.dataset.label ?? c.label}: ${fmtCell(v as number, { currency: widget.format?.currency })}`;
              },
            },
          },
        },
        scales: isPie ? undefined : {
          x: {
            grid: { color: GRID }, ticks: { color: TICK, font: { size: 10 }, maxRotation: 45, autoSkipPadding: 8 },
            stacked: type === 'bar' && widget.type === 'stackedBar',
            type: widget.type === 'scatter' ? 'linear' : 'category',
          },
          y: {
            grid: { color: GRID },
            ticks: { color: TICK, font: { size: 10 }, callback: (v: unknown) => fmtNum(Number(v)) },
            stacked: type === 'bar' && widget.type === 'stackedBar',
            beginAtZero: true,
          },
        },
      },
    });
    chartRef.current = chart;
    return () => { chart.destroy(); chartRef.current = null; };
  }, [labels, datasets, type, widget.drillFilterColumn, widget.format?.currency, onSlice, widget.type]);

  return (
    <div style={{ height: h }} className={cx('px-2 pb-2', onSlice && widget.drillFilterColumn && 'cursor-pointer')}>
      <canvas ref={canvasRef} role="img" aria-label={widget.title} />
    </div>
  );
}

function gradient(ctx: CanvasRenderingContext2D | null, color: string): CanvasGradient | string {
  if (!ctx) return color;
  try {
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, color + '59'); // 35%
    g.addColorStop(1, color + '00');
    return g;
  } catch { return color; }
}

function buildChartData(widget: WidgetSpec, result: QueryResult) {
  const { columns, rows } = result.table;
  const groupCount = Math.max(1, (widget.query.groupBy?.length ?? 0)) ;
  const metricCount = widget.query.metrics.length;
  const shareCol = columns.indexOf('% of total');
  const firstMetricCol = widget.query.aging ? 1 : groupCount;

  if (widget.type === 'scatter') {
    // grouped rows: x = metric1, y = metric2
    const data = rows.map((r) => ({
      x: Number(r[firstMetricCol] ?? 0),
      y: Number(r[firstMetricCol + 1] ?? 0),
      label: String(r[0] ?? ''),
    }));
    return {
      labels: rows.map((r) => String(r[0] ?? '')),
      type: 'scatter',
      datasets: [{
        label: columns[firstMetricCol + 1] ?? 'y',
        data,
        backgroundColor: '#3a6df4cc',
        borderColor: 'rgba(255,255,255,0.25)',
        pointRadius: 5, pointHoverRadius: 7,
      }],
    };
  }

  const labels = rows.map((r) =>
    groupCount > 1 && !widget.query.aging
      ? r.slice(0, groupCount).map((c) => String(c ?? '')).join(' · ')
      : String(r[0] ?? ''),
  );

  const isPieType = widget.type === 'pie' || widget.type === 'donut';
  if (isPieType) {
    const values = rows.map((r) => Number(r[firstMetricCol] ?? 0));
    return {
      labels,
      type: widget.type === 'pie' ? 'pie' : 'doughnut',
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: '#0c0e1c', borderWidth: 2, hoverOffset: 6,
      }],
    };
  }

  const lineLike = widget.type === 'line' || widget.type === 'area';
  const metricCols: number[] = [];
  for (let i = 0; i < metricCount && metricCols.length < 3; i++) {
    const ci = firstMetricCol + i;
    if (ci < columns.length && ci !== shareCol) metricCols.push(ci);
  }
  const datasets = metricCols.map((ci, di) => {
    const color = PALETTE[di % PALETTE.length];
    return {
      label: columns[ci],
      data: rows.map((r) => Number(r[ci] ?? 0)),
      backgroundColor: lineLike
        ? (c: any) => gradient(c.chart?.ctx ?? null, color)
        : labels.map((_, i) => (metricCols.length > 1 ? color : PALETTE[i % PALETTE.length] + 'd9')),
      borderColor: color,
      borderWidth: lineLike ? 2 : 0,
      borderRadius: lineLike ? undefined : 6,
      fill: lineLike,
      tension: 0.35,
      pointRadius: rows.length > 40 ? 0 : 3,
      pointBackgroundColor: color,
    };
  });
  return { labels, type: lineLike ? 'line' : 'bar', datasets };
}

function AgingView({
  widget, result, onSlice, height,
}: { widget: WidgetSpec; result: QueryResult; onSlice?: (l: string) => void; height?: number }) {
  const { columns, rows } = result.table;
  const shareCol = columns.indexOf('% of total');
  const valueCol = 1;
  const max = Math.max(...rows.map((r) => Math.abs(Number(r[valueCol] ?? 0))), 1);
  return (
    <div className="px-4 pb-4 space-y-2 overflow-y-auto" style={{ maxHeight: height ?? 300 }}>
      {rows.map((r, i) => {
        const label = String(r[0]);
        const v = Number(r[valueCol] ?? 0);
        const pct = shareCol >= 0 ? Number(r[shareCol] ?? 0) : null;
        const color = label === 'Not due' ? AGING_COLORS[0] : AGING_COLORS[Math.min(i + (rows[0]?.[0] === 'Not due' ? 0 : 1), AGING_COLORS.length - 1)];
        return (
          <button
            key={label}
            onClick={() => onSlice?.(label)}
            className="w-full text-left group"
            aria-label={`${label}: ${fmtNum(v, { currency: widget.format?.currency })}`}
          >
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-mist-300">{label}</span>
              <span className="num text-mist-50 font-medium">
                {fmtNum(v, { currency: widget.format?.currency })}
                {pct !== null && <span className="text-mist-500 ml-1.5">{pct}%</span>}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all group-hover:brightness-125"
                style={{ width: `${Math.max(2, (100 * Math.abs(v)) / max)}%`, background: color }}
              />
            </div>
          </button>
        );
      })}
      {result.totals && (
        <div className="flex justify-between text-xs pt-2 border-t border-white/5 text-mist-300">
          <span>Total</span>
          <span className="num font-semibold text-mist-50">
            {fmtNum(Number(result.totals[valueCol] ?? 0), { currency: widget.format?.currency })}
          </span>
        </div>
      )}
    </div>
  );
}

function TableView({ widget, result }: { widget: WidgetSpec; result: QueryResult }) {
  const { columns, types, rows } = result.table;
  const [sort, setSort] = useState<{ ci: number; dir: 1 | -1 } | null>(null);
  const [search, setSearch] = useState('');
  const shareCol = columns.indexOf('% of total');
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.some((v) => v !== null && String(v).toLowerCase().includes(q)));
  }, [rows, search]);
  const sorted = useMemo(() => {
    if (!sort) return searched;
    const { ci, dir } = sort;
    return [...searched].sort((a, b) => {
      const x = a[ci], y = b[ci];
      if (x === null) return 1;
      if (y === null) return -1;
      if (typeof x === 'number' && typeof y === 'number') return dir * (x - y);
      return dir * String(x).localeCompare(String(y));
    });
  }, [searched, sort]);
  const maxShare = shareCol >= 0 ? Math.max(...rows.map((r) => Number(r[shareCol] ?? 0)), 1) : 1;
  return (
    <div className="data-table overflow-auto max-h-80 px-1 pb-2">
      {rows.length > 10 && (
        <div className="sticky left-0 px-2 pb-2">
          <input
            className="w-full max-w-xs rounded-lg bg-ink-800/80 border border-white/10 px-3 py-1.5 text-[11px] text-mist-50 placeholder-mist-500 outline-none focus:border-pulse-500/50"
            placeholder={`Search ${rows.length.toLocaleString()} rows…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search table rows"
          />
        </div>
      )}
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-ink-800/95 backdrop-blur">
            {columns.map((c, ci) => (
              <th
                key={c}
                onClick={() => setSort((s) => (s?.ci === ci ? { ci, dir: s.dir === 1 ? -1 : 1 } : { ci, dir: -1 }))}
                className={cx(
                  'px-3 py-2 font-medium text-mist-400 cursor-pointer select-none whitespace-nowrap hover:text-mist-50',
                  types[ci] === 'number' ? 'text-right' : 'text-left',
                )}
              >
                {c}{sort?.ci === ci ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, ri) => (
            <tr key={ri} className={ri % 2 ? 'bg-white/[0.02]' : ''}>
              {r.map((v, ci) => (
                <td
                  key={ci}
                  className={cx(
                    'px-3 py-1.5 whitespace-nowrap max-w-[260px] overflow-hidden text-ellipsis',
                    types[ci] === 'number' ? 'text-right num text-mist-50' : 'text-left text-mist-300',
                  )}
                >
                  {ci === shareCol && typeof v === 'number' ? (
                    <span className="inline-flex items-center gap-1.5 justify-end">
                      <span className="inline-block h-1.5 w-12 rounded-full bg-white/5 overflow-hidden">
                        <span className="block h-full bg-pulse-500 rounded-full" style={{ width: `${(100 * v) / maxShare}%` }} />
                      </span>
                      {v}%
                    </span>
                  ) : (
                    fmtCell(v, { currency: ci >= columns.length - (widget.query.metrics.length + (shareCol >= 0 ? 1 : 0)) ? widget.format?.currency : undefined })
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {result.totals && (
          <tfoot>
            <tr className="border-t border-white/10">
              {result.totals.map((v, ci) => (
                <td key={ci} className={cx('px-3 py-2 font-semibold text-mist-50', types[ci] === 'number' ? 'text-right num' : 'text-left')}>
                  {ci === shareCol && typeof v === 'number' ? `${v}%` : fmtCell(v, { currency: widget.format?.currency })}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
