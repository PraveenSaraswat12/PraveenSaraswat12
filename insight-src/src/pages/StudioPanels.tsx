// Dashboards (cross-filtered grid), Chat analyst, Insights feed.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { billing } from '../billing';
import type {
  AggKind, DashboardSpec, QueryResult, WidgetSpec, WidgetType,
} from '../contracts/types';
import { engine, uid, titleCase } from '../engine';
import { Badge, Button, Card, cx, EmptyState, Field, inputCls, Modal } from '../ui/components';
import {
  ChartIcon, ChatIcon, DownloadIcon, FilterIcon, GridIcon, PinIcon, PlusIcon,
  SparkIcon, WandIcon, XIcon,
} from '../ui/icons';
import { WidgetView } from '../ui/charts/WidgetView';
import { useApp, useChat, useData } from '../ui/state/stores';

// ── shared widget card ───────────────────────────────────────────────────────

function useWidgetResult(w: WidgetSpec): { result: QueryResult | null; error?: string } {
  const data = useData();
  return useMemo(() => {
    try {
      const q = data.mergedQuery(w);
      return { result: engine.runQuery(q, { tables: data.tables, relations: data.relations, intent: data.intent }) };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Could not compute' };
    }
    // activeFilters & tables drive recompute
  }, [w, data.tables, data.activeFilters, data.relations, data.intent]);
}

const SIZE_SPAN: Record<WidgetSpec['size'], string> = {
  sm: 'col-span-2 sm:col-span-1',
  md: 'col-span-2',
  lg: 'col-span-2 lg:col-span-2',
  xl: 'col-span-2 lg:col-span-4',
};

function WidgetCard({ w, dashId }: { w: WidgetSpec; dashId: string }) {
  const { result, error } = useWidgetResult(w);
  const data = useData();
  const chat = useChat();
  const canExport = billing.canExport();

  const downloadCSV = () => {
    if (!result) return;
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [result.table.columns.map(esc).join(',')];
    for (const r of result.table.rows) lines.push(r.map(esc).join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `${w.title.replace(/\W+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card className={cx('flex flex-col anim-fade-up', SIZE_SPAN[w.size])}>
      <div className="flex items-start justify-between px-4 pt-3.5 pb-2 gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-medium text-mist-50 truncate">{w.title}</h3>
          {w.subtitle && <p className="text-[10px] text-mist-500 truncate">{w.subtitle}</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            title="Ask about this"
            aria-label="Ask about this"
            className="p-1.5 rounded-lg text-mist-500 hover:text-pulse-300 hover:bg-white/5"
            onClick={() => { data.setTab('chat'); setTimeout(() => chat.ask(`Tell me about: ${w.title}`), 60); }}
          >
            <ChatIcon size={14} />
          </button>
          {canExport && result && (
            <button title="Download CSV" aria-label="Download CSV" onClick={downloadCSV}
              className="p-1.5 rounded-lg text-mist-500 hover:text-glow-400 hover:bg-white/5">
              <DownloadIcon size={14} />
            </button>
          )}
          <button
            title="Remove" aria-label="Remove widget"
            className="p-1.5 rounded-lg text-mist-500 hover:text-rosex-400 hover:bg-white/5"
            onClick={() => data.removeWidget(dashId, w.id)}
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <WidgetView
          widget={w} result={result} error={error}
          onSlice={(label) => data.crossFilter(w, label)}
        />
      </div>
    </Card>
  );
}

// ── Dashboards panel ─────────────────────────────────────────────────────────

export function DashboardsPanel() {
  const data = useData();
  const [builderOpen, setBuilderOpen] = useState(false);

  if (!data.dashboards.length) {
    return (
      <EmptyState
        icon={<GridIcon />}
        title="No dashboards yet"
        body="Add data, tell Insight what you need in plain words, approve the plan — done."
        action={
          <Button
            onClick={() =>
              data.tables.length
                ? data.intent ? data.setTab('wizard') : data.setPhase('goals')
                : data.setTab('data')
            }
          >
            <WandIcon size={16} />{' '}
            {data.tables.length ? (data.intent ? 'Refine' : 'Tell me what you need') : 'Add data first'}
          </Button>
        }
      />
    );
  }

  const dash = data.dashboards.find((d) => d.id === data.activeDashboardId) ?? data.dashboards[0];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* dashboard tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {data.dashboards.map((d) => (
          <button
            key={d.id}
            title={d.description}
            onClick={() => data.setActiveDashboard(d.id)}
            className={cx(
              'px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition border',
              d.id === dash.id
                ? 'bg-pulse-500/15 text-pulse-300 border-pulse-500/40'
                : 'text-mist-400 border-white/10 hover:text-mist-100',
            )}
          >
            {d.name}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => data.setTab('wizard')} title="Re-run the questionnaire">
          <WandIcon size={15} /> <span className="hidden sm:inline">Refine</span>
        </Button>
        <Button variant="soft" onClick={() => setBuilderOpen(true)}>
          <PlusIcon size={15} /> <span className="hidden sm:inline">Add chart</span>
        </Button>
      </div>

      <FilterBar dash={dash} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {dash.widgets.map((w) => <WidgetCard key={w.id} w={w} dashId={dash.id} />)}
      </div>

      <WidgetBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} />
    </div>
  );
}

function FilterBar({ dash }: { dash: DashboardSpec }) {
  const data = useData();
  const [customRange, setCustomRange] = useState(false);
  const quickDates: [string, number | null][] = [['All time', null], ['Last 30 days', 30], ['Last 90 days', 90], ['This year', 365]];

  const filterDefs = dash.globalFilterColumns
    .map((ref) => {
      const t = data.tables.find((x) => x.id === ref.tableId);
      const p = t?.profiles.find((x) => x.name === ref.column);
      return t && p ? { ref, values: (p.topValues ?? []).map((v) => v.value) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  // every other category column on this dashboard's tables can become a filter
  const addable = dash.tableIds
    .flatMap((tid) => {
      const t = data.tables.find((x) => x.id === tid);
      return (t?.profiles ?? [])
        .filter((p) => p.isCategory)
        .map((p) => ({ tableId: tid, column: p.name }));
    })
    .filter((ref) =>
      !dash.globalFilterColumns.some((f) => f.tableId === ref.tableId && f.column === ref.column));

  if (!filterDefs.length && !dash.dateColumn && !addable.length) return null;

  return (
    <div className="glass rounded-xl2 px-3.5 py-2.5 flex items-center gap-2 flex-wrap text-xs">
      <FilterIcon size={14} className="text-mist-500 shrink-0" />
      {filterDefs.map(({ ref, values }) => {
        const active = data.activeFilters.find((f) => f.ref.column === ref.column && f.ref.tableId === ref.tableId);
        return (
          <select
            key={`${ref.tableId}.${ref.column}`}
            aria-label={`Filter by ${ref.column}`}
            className="bg-ink-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-mist-300 outline-none focus:border-pulse-500/50 max-w-[150px]"
            value={active ? String(active.filter.value) : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                const idx = data.activeFilters.findIndex((f) => f === active);
                if (idx >= 0) data.removeFilter(idx);
              } else {
                data.setFilter({ ref, filter: { column: ref.column, op: 'eq', value: v }, label: `${ref.column}: ${v}` });
              }
            }}
          >
            <option value="">{titleCase(ref.column)}: all</option>
            {values.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        );
      })}
      {dash.dateColumn && (
        <select
          aria-label="Date range"
          className="bg-ink-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-mist-300 outline-none focus:border-pulse-500/50"
          value={customRange ? 'custom' : (() => {
            const f = data.activeFilters.find((x) => x.ref.column === dash.dateColumn!.column && x.filter.op === 'gte');
            return f ? String(f.label.split('·')[1] ?? '') : '';
          })()}
          onChange={(e) => {
            const col = dash.dateColumn!;
            const clear = () => {
              const idx = data.activeFilters.findIndex(
                (x) => x.ref.column === col.column && (x.filter.op === 'gte' || x.filter.op === 'between'));
              if (idx >= 0) data.removeFilter(idx);
            };
            if (e.target.value === 'custom') { clear(); setCustomRange(true); return; }
            setCustomRange(false);
            const days = e.target.value ? Number(e.target.value) : null;
            clear();
            if (days) {
              const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
              data.setFilter({
                ref: col, filter: { column: col.column, op: 'gte', value: from },
                label: `Since ${from}·${days}`,
              });
            }
          }}
        >
          {quickDates.map(([label, d]) => <option key={label} value={d ?? ''}>{label}</option>)}
          <option value="custom">Custom dates…</option>
        </select>
      )}
      {dash.dateColumn && customRange && (
        <CustomDateRange
          onApply={(from, to) => {
            const col = dash.dateColumn!;
            data.setFilter({
              ref: col,
              filter: { column: col.column, op: 'between', value: [from, to] },
              label: `${from} → ${to}`,
            });
          }}
        />
      )}
      {addable.length > 0 && (
        <select
          aria-label="Add a filter"
          className="bg-ink-800 border border-dashed border-white/15 rounded-lg px-2.5 py-1.5 text-mist-500 outline-none focus:border-pulse-500/50"
          value=""
          onChange={(e) => {
            const [tableId, column] = e.target.value.split('¦');
            if (tableId && column) data.addGlobalFilterColumn(dash.id, { tableId, column });
          }}
        >
          <option value="">＋ Add filter</option>
          {addable.map((r) => (
            <option key={`${r.tableId}¦${r.column}`} value={`${r.tableId}¦${r.column}`}>
              {titleCase(r.column)}
            </option>
          ))}
        </select>
      )}
      {data.activeFilters.map((f, i) => (
        <button
          key={`${f.label}-${i}`}
          onClick={() => data.removeFilter(i)}
          className="inline-flex items-center gap-1 rounded-full bg-pulse-500/15 border border-pulse-500/40 text-pulse-300 px-2.5 py-1"
        >
          {f.label.split('·')[0]} <XIcon size={11} />
        </button>
      ))}
      {data.activeFilters.length > 0 && (
        <button onClick={data.clearFilters} className="text-mist-500 hover:text-mist-200 ml-auto">Clear all</button>
      )}
    </div>
  );
}

function CustomDateRange({ onApply }: { onApply: (from: string, to: string) => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const cls = 'bg-ink-800 border border-white/10 rounded-lg px-2 py-1 text-mist-300 outline-none focus:border-pulse-500/50 [color-scheme:dark]';
  return (
    <span className="inline-flex items-center gap-1.5">
      <input type="date" aria-label="From date" className={cls} value={from} onChange={(e) => setFrom(e.target.value)} />
      <span className="text-mist-600">→</span>
      <input type="date" aria-label="To date" className={cls} value={to} onChange={(e) => setTo(e.target.value)} />
      <Button variant="soft" className="!px-2.5 !py-1 text-[11px]" disabled={!from || !to || from > to} onClick={() => onApply(from, to)}>
        Apply
      </Button>
    </span>
  );
}

function WidgetBuilder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const [tableId, setTableId] = useState('');
  const [metric, setMetric] = useState('');
  const [agg, setAgg] = useState<AggKind>('sum');
  const [groupBy, setGroupBy] = useState('');
  const [type, setType] = useState<WidgetType>('bar');

  useEffect(() => {
    if (open && data.tables[0]) {
      const t = data.tables[0];
      setTableId(t.id);
      setMetric(t.profiles.find((p) => p.isMetric)?.name ?? '');
      setGroupBy(t.profiles.find((p) => p.isCategory)?.name ?? '');
    }
  }, [open, data.tables]);

  const t = data.tables.find((x) => x.id === tableId);

  const addIt = () => {
    if (!t) return;
    const w: WidgetSpec = {
      id: uid('w'),
      title: `${titleCase(agg)} ${titleCase(metric || 'rows')}${groupBy ? ` by ${titleCase(groupBy)}` : ''}`,
      subtitle: 'custom chart',
      type,
      size: type === 'table' ? 'xl' : type === 'kpi' ? 'sm' : 'md',
      drillFilterColumn: groupBy || undefined,
      query: {
        tableId: t.id,
        metrics: metric ? [{ column: metric, agg }] : [{ column: '*', agg: 'count', as: 'Count' }],
        groupBy: groupBy && type !== 'kpi' ? [groupBy] : undefined,
        timeGrain: t.profiles.find((p) => p.name === groupBy)?.isDate ? 'month' : undefined,
        filters: [],
        limit: 12,
        withShare: type === 'donut' || type === 'pie',
      },
    };
    data.addWidget(w);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a chart">
      <div className="space-y-3">
        <Field label="Table">
          <select className={inputCls} value={tableId} onChange={(e) => setTableId(e.target.value)}>
            {data.tables.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Measure">
            <select className={inputCls} value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="">(row count)</option>
              {t?.profiles.filter((p) => p.isMetric).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Aggregation">
            <select className={inputCls} value={agg} onChange={(e) => setAgg(e.target.value as AggKind)}>
              {(['sum', 'avg', 'count', 'min', 'max', 'median', 'distinct'] as AggKind[]).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Group by">
            <select className={inputCls} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              <option value="">(none)</option>
              {t?.profiles.filter((p) => p.isCategory || p.isDate).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Chart type">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as WidgetType)}>
              {(['bar', 'line', 'area', 'donut', 'pie', 'table', 'kpi'] as WidgetType[]).map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
        </div>
        <Button className="w-full mt-2" onClick={addIt} disabled={!t}>Add to dashboard</Button>
      </div>
    </Modal>
  );
}

// ── Chat panel ───────────────────────────────────────────────────────────────

export function ChatPanel() {
  const data = useData();
  const chat = useChat();
  const busy = useChat((s) => s.busy);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const planDef = billing.plan(billing.currentPlan());
  const usage = billing.usageToday();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [data.chat.length, busy]);

  const send = () => {
    if (!input.trim() || busy) return;
    chat.ask(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4.5rem)] md:h-[calc(100vh-3.5rem-1px)] max-w-3xl mx-auto w-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {!data.chat.length && (
          <EmptyState
            icon={<ChatIcon />}
            title="Ask anything about your data"
            body="Every number in every answer is computed from your actual rows. Charts and tables included."
            action={!data.tables.length ? <Button onClick={() => data.setTab('data')}>Add data first</Button> : undefined}
          />
        )}
        {!data.chat.length && data.tables.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {chat.suggestions().map((s) => (
              <button
                key={s}
                onClick={() => chat.ask(s)}
                className="glass rounded-full px-3.5 py-1.5 text-xs text-mist-300 hover:text-pulse-300 hover:border-pulse-500/40 transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {data.chat.map((turn) => (
          <div key={turn.id} className={cx('anim-pop', turn.role === 'user' ? 'flex justify-end' : '')}>
            {turn.role === 'user' ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-pulse-500/20 border border-pulse-500/30 px-4 py-2.5 text-sm text-mist-50">
                {turn.text}
              </div>
            ) : (
              <div className="max-w-[95%] space-y-3">
                <div className="glass rounded-2xl rounded-bl-md px-4 py-3 text-sm text-mist-100 whitespace-pre-wrap">
                  {turn.text}
                  {turn.source && (
                    <div className="mt-2">
                      <Badge tone={turn.source === 'cloud-ai' ? 'violet' : 'gray'}>
                        {turn.source === 'cloud-ai' ? 'cloud AI' : turn.source === 'system' ? 'system' : 'computed locally'}
                      </Badge>
                    </div>
                  )}
                </div>
                {(turn.attachments ?? []).map((a) => (
                  <Card key={a.widget.id} className="overflow-hidden">
                    <div className="flex items-center justify-between px-4 pt-3 pb-1">
                      <div className="text-xs font-medium text-mist-50">{a.widget.title}</div>
                      <button
                        title="Pin to dashboard" aria-label="Pin to dashboard"
                        className="p-1.5 rounded-lg text-mist-500 hover:text-pulse-300 hover:bg-white/5"
                        onClick={() => data.pinWidget(a.widget)}
                      >
                        <PinIcon size={14} />
                      </button>
                    </div>
                    <WidgetView widget={a.widget} result={a.result} height={a.widget.type === 'kpi' ? undefined : 220} />
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="glass rounded-2xl rounded-bl-md px-4 py-3 inline-flex items-center gap-1.5 w-fit" aria-label="Analyst is thinking">
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-mist-400 inline-block" />
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-mist-400 inline-block" />
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-mist-400 inline-block" />
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="px-4 pb-4 pt-2">
        <div className="glass-deep rounded-2xl p-2 flex items-end gap-2">
          <textarea
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-mist-50 placeholder-mist-500 px-2.5 py-2 max-h-32"
            placeholder={data.tables.length ? 'e.g. Top 10 customers by revenue this year' : 'Add data first, then ask away'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            aria-label="Ask the analyst"
          />
          <Button onClick={send} disabled={!input.trim() || busy} aria-label="Send">Ask</Button>
        </div>
        <p className="text-[10px] text-mist-600 mt-1.5 text-center num">
          {usage.aiQuestions}/{planDef.limits.aiQuestionsPerDay} questions today · answers are computed from your data
        </p>
      </div>
    </div>
  );
}

// ── Insights panel ───────────────────────────────────────────────────────────

const SEV_TONE: Record<string, 'rose' | 'amber' | 'teal' | 'blue'> = {
  critical: 'rose', warn: 'amber', good: 'teal', info: 'blue',
};
const SEV_BORDER: Record<string, string> = {
  critical: 'border-l-rosex-400', warn: 'border-l-amberx-400',
  good: 'border-l-glow-400', info: 'border-l-pulse-500',
};

export function InsightsPanel() {
  const data = useData();
  const chat = useChat();
  if (!data.insights.length) {
    return (
      <EmptyState
        icon={<SparkIcon />}
        title="No findings yet"
        body="Once your dashboards are built, Insight scans for trends, outliers, concentration risks, aging and quality issues."
        action={data.tables.length ? <Button onClick={() => data.regenerate()}>Scan now</Button> : <Button onClick={() => data.setTab('data')}>Add data</Button>}
      />
    );
  }
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-mist-50">Automatic findings</h2>
        <Button variant="ghost" onClick={() => data.regenerate()}><SparkIcon size={15} /> Re-scan</Button>
      </div>
      {data.insights.map((ins) => (
        <Card key={ins.id} className={cx('p-4 border-l-2', SEV_BORDER[ins.severity])}>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={SEV_TONE[ins.severity]}>{ins.kind}</Badge>
            <h3 className="text-sm font-medium text-mist-50">{ins.title}</h3>
          </div>
          <p className="text-xs text-mist-400 mt-1.5">{ins.detail}</p>
          {ins.widget && (
            <div className="mt-3 rounded-xl border border-white/5 overflow-hidden">
              <InsightWidget w={ins.widget} />
            </div>
          )}
          <button
            className="text-[11px] text-pulse-300 hover:text-pulse-400 mt-2.5 inline-flex items-center gap-1"
            onClick={() => { data.setTab('chat'); setTimeout(() => chat.ask(`Explain this finding: ${ins.title}`), 60); }}
          >
            <ChatIcon size={12} /> Open in chat
          </button>
        </Card>
      ))}
    </div>
  );
}

function InsightWidget({ w }: { w: WidgetSpec }) {
  const { result, error } = useWidgetResult(w);
  return <WidgetView widget={w} result={result} error={error} height={200} />;
}

export { ChartIcon };
