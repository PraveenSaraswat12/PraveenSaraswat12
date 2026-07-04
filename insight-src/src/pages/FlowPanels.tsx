// The guided journey after a silent ingest:
// 1) SummaryPanel  — "I've read everything, it's saved" (zero questions)
// 2) GoalsPanel    — three human questions, chips + free text, no schema words
// 3) ProposalPanel — the dashboard plan to approve/trim before building
import React, { useMemo, useState } from 'react';
import type { GoalAnswers } from '../contracts/types';
import { engine } from '../engine';
import { Badge, Button, Card, cx, Skeleton, Spinner } from '../ui/components';
import { ArrowRight, CheckIcon, ChartIcon, FilterIcon, LinkIcon, SparkIcon, TableIcon } from '../ui/icons';
import { useData } from '../ui/state/stores';

// ── 1 · summary ──────────────────────────────────────────────────────────────

export function SummaryPanel() {
  const data = useData();
  const rows = data.tables.reduce((a, t) => a + t.rowCount, 0);
  const relNote = data.relations[0];
  const from = relNote && data.tables.find((t) => t.id === relNote.fromTableId)?.name;
  const to = relNote && data.tables.find((t) => t.id === relNote.toTableId)?.name;

  return (
    <div className="max-w-xl mx-auto p-5 pt-14 anim-fade-up">
      <Card className="p-7 text-center">
        <div className="mx-auto w-12 h-12 grid place-items-center rounded-2xl bg-glow-500/15 text-glow-400 mb-4">
          <CheckIcon size={24} />
        </div>
        <h2 className="font-display text-xl text-mist-50">Read everything. Saved securely.</h2>
        <p className="text-sm text-mist-400 mt-2">
          {data.sources.length} file{data.sources.length !== 1 ? 's' : ''} ·{' '}
          {data.tables.length} table{data.tables.length !== 1 ? 's' : ''} ·{' '}
          <span className="num">{rows.toLocaleString()}</span> rows — every column understood
          {relNote && from && to ? (
            <> · linked <b className="text-mist-200">{from} ↔ {to}</b></>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center mt-4">
          {data.tables.slice(0, 3).map((t) => (
            <Badge key={t.id} tone="gray">{t.name} · {t.rowCount.toLocaleString()} rows</Badge>
          ))}
          {data.tables.length > 3 && <Badge tone="gray">+{data.tables.length - 3} more</Badge>}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
          <Button onClick={() => data.setPhase('goals')} className="px-6">
            Continue — tell me what you need <ArrowRight size={16} />
          </Button>
          <Button variant="ghost" onClick={() => { data.setPhase('ready'); data.setTab('data'); }}>
            Look at the data first
          </Button>
        </div>
        <p className="text-[11px] text-mist-500 mt-4">
          No schema questions — next I'll only ask what you want to learn, then propose your dashboard.
        </p>
      </Card>
    </div>
  );
}

// ── 2 · goals ────────────────────────────────────────────────────────────────

const GOAL_SECTIONS: { key: keyof GoalAnswers; title: string; hint: string }[] = [
  { key: 'learn', title: 'What do you want to learn from this data?', hint: 'Tap a suggestion or write in your own words.' },
  { key: 'decide', title: 'What decision should it help you make?', hint: 'Optional — it sharpens what the dashboard leads with.' },
  { key: 'custom', title: 'Anything custom you track?', hint: 'Targets, deadlines, teams, regions, aging like 15/30/45 days…' },
];

export function GoalsPanel() {
  const data = useData();
  const chips = useMemo(
    () => engine.suggestGoalChips(data.tables, data.relations),
    [data.tables, data.relations],
  );
  const [answers, setAnswers] = useState<GoalAnswers>(data.goals ?? {});

  if (data.generating) return <FlowSpinner label="Understanding what you need…" />;

  const toggleChip = (key: keyof GoalAnswers, chip: string) => {
    setAnswers((a) => {
      const cur = a[key] ?? '';
      const has = cur.includes(chip);
      const next = has
        ? cur.replace(chip, '').replace(/\s*·\s*·\s*/g, ' · ').replace(/^\s*·\s*|\s*·\s*$/g, '').trim()
        : cur ? `${cur} · ${chip}` : chip;
      return { ...a, [key]: next };
    });
  };

  return (
    <div className="max-w-xl mx-auto p-5 pt-10 anim-fade-up space-y-5">
      <div className="text-center">
        <h2 className="font-display text-xl text-mist-50">Tell me what you need</h2>
        <p className="text-xs text-mist-400 mt-1.5">
          Plain language only — I'll map it to your data myself.
        </p>
      </div>

      {GOAL_SECTIONS.map((sec) => (
        <Card key={sec.key} className="p-5">
          <h3 className="text-sm font-medium text-mist-50">{sec.title}</h3>
          <p className="text-[11px] text-mist-500 mt-0.5">{sec.hint}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {chips[sec.key].map((c) => {
              const on = (answers[sec.key] ?? '').includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleChip(sec.key, c)}
                  className={cx(
                    'rounded-full px-3 py-1.5 text-xs border transition',
                    on
                      ? 'bg-pulse-500/20 border-pulse-500/60 text-pulse-300'
                      : 'border-white/10 text-mist-300 hover:border-pulse-500/40 hover:text-mist-100',
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <input
            className="mt-3 w-full rounded-xl bg-ink-800/80 border border-white/10 px-3.5 py-2.5 text-sm text-mist-50 placeholder-mist-500 outline-none focus:border-pulse-500/60 transition"
            placeholder="…or type it your way"
            value={answers[sec.key] ?? ''}
            onChange={(e) => setAnswers((a) => ({ ...a, [sec.key]: e.target.value }))}
          />
        </Card>
      ))}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => data.setPhase('summary')}>Back</Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => data.submitGoals({})}>
            Skip — decide for me
          </Button>
          <Button onClick={() => data.submitGoals(answers)}>
            Show my dashboard plan <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── 3 · proposal ─────────────────────────────────────────────────────────────

const KIND_ICON: Record<string, React.ReactNode> = {
  widget: <ChartIcon size={15} />,
  filter: <FilterIcon size={15} />,
};

export function ProposalPanel() {
  const data = useData();
  if (data.generating) return <FlowSpinner label="Building your dashboards…" />;
  const proposal = data.proposal;
  if (!proposal) return null;

  const groups = new Map<string, typeof proposal.items>();
  for (const item of proposal.items) {
    const g = groups.get(item.dashboardName) ?? [];
    g.push(item);
    groups.set(item.dashboardName, g);
  }
  const enabledCount = Object.values(data.proposalEnabled).filter(Boolean).length;

  return (
    <div className="max-w-2xl mx-auto p-5 pt-10 anim-fade-up">
      <div className="text-center mb-6">
        <h2 className="font-display text-xl text-mist-50">Here's your dashboard plan</h2>
        <p className="text-xs text-mist-400 mt-1.5">
          Built for: <span className="text-mist-200">{proposal.intent.goal}</span> —
          untick anything you don't want, then build.
        </p>
      </div>

      <div className="space-y-4">
        {[...groups.entries()].map(([dashName, items]) => (
          <Card key={dashName} className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TableIcon size={16} className="text-pulse-400" />
              <h3 className="font-display text-sm text-mist-50">{dashName} dashboard</h3>
              <span className="text-[10px] text-mist-500 num ml-auto">
                {items.filter((i) => data.proposalEnabled[i.id]).length}/{items.length} selected
              </span>
            </div>
            <div className="space-y-1.5">
              {items.map((item) => {
                const on = !!data.proposalEnabled[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => data.toggleProposalItem(item.id)}
                    className={cx(
                      'w-full flex items-start gap-3 text-left rounded-xl px-3 py-2.5 border transition',
                      on ? 'border-pulse-500/30 bg-pulse-500/5' : 'border-white/5 opacity-50',
                    )}
                  >
                    <span className={cx(
                      'w-4 h-4 mt-0.5 shrink-0 grid place-items-center rounded border text-[9px]',
                      on ? 'bg-pulse-500 border-pulse-500 text-white' : 'border-white/20 text-transparent',
                    )}>✓</span>
                    <span className={cx('mt-0.5 shrink-0', item.kind === 'filter' ? 'text-glow-400' : 'text-aura-400')}>
                      {KIND_ICON[item.kind]}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-mist-50">{item.title}</span>
                      <span className="block text-[11px] text-mist-500">{item.reason}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={() => data.setPhase('goals')}>Back</Button>
        <Button disabled={!enabledCount} onClick={() => data.approveProposal()} className="px-6">
          <SparkIcon size={16} /> Build my dashboards ({enabledCount})
        </Button>
      </div>
      <p className="text-[11px] text-mist-500 text-center mt-3">
        You can add more charts, filters and even column-level tweaks later ("Refine").
      </p>
    </div>
  );
}

function FlowSpinner({ label }: { label: string }) {
  const data = useData();
  return (
    <div className="max-w-xl mx-auto p-6 pt-20 text-center space-y-4">
      <Spinner size={28} />
      <p className="font-display text-mist-50">{label}</p>
      <p className="text-xs text-mist-400">
        {data.tables.reduce((a, t) => a + t.rowCount, 0).toLocaleString()} rows ·{' '}
        {data.tables.length} table{data.tables.length !== 1 ? 's' : ''} ·{' '}
        {data.relations.length} link{data.relations.length !== 1 ? 's' : ''}
      </p>
      <div className="space-y-2 pt-4">
        <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
      </div>
    </div>
  );
}

export { LinkIcon };
