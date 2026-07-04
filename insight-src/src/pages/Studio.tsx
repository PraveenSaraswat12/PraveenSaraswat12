// The studio shell: rail navigation + Data / Wizard / Workspaces panels.
// Dashboards, Chat and Insights panels live in StudioPanels.tsx.
import React, { useEffect, useRef, useState } from 'react';
import { billing } from '../billing';
import type { WizardAnswers } from '../contracts/types';
import { Badge, Button, Card, cx, EmptyState, inputCls, Skeleton, Spinner } from '../ui/components';
import {
  ChartIcon, ChatIcon, FileIcon, FolderIcon, GearIcon, GlobeIcon, GridIcon,
  LinkIcon, Logo, SparkIcon, TableIcon, TrashIcon, UploadIcon, WandIcon, XIcon,
} from '../ui/icons';
import { useApp, useAuth, useChat, useData, type StudioTab } from '../ui/state/stores';
import { DashboardsPanel, ChatPanel, InsightsPanel } from './StudioPanels';

const TABS: { id: StudioTab; label: string; icon: React.ReactNode }[] = [
  { id: 'data', label: 'Data', icon: <TableIcon size={18} /> },
  { id: 'wizard', label: 'Questions', icon: <WandIcon size={18} /> },
  { id: 'dashboards', label: 'Dashboards', icon: <GridIcon size={18} /> },
  { id: 'chat', label: 'Chat', icon: <ChatIcon size={18} /> },
  { id: 'insights', label: 'Insights', icon: <SparkIcon size={18} /> },
  { id: 'workspaces', label: 'Workspaces', icon: <FolderIcon size={18} /> },
];

export default function Studio() {
  const user = useAuth((s) => s.user);
  const plan = useAuth((s) => s.plan);
  const navigate = useApp((s) => s.navigate);
  const data = useData();
  const [nameEdit, setNameEdit] = useState<string | null>(null);

  useEffect(() => { data.refreshList(); }, []);
  useEffect(() => { if (!user) navigate('auth'); }, [user, navigate]);
  if (!user) return null;

  const planDef = billing.plan(plan);

  return (
    <div className="min-h-screen flex flex-col">
      {/* topbar */}
      <header className="glass-deep sticky top-0 z-40">
        <div className="px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate('landing')} aria-label="Home"><Logo size={22} /></button>
          {nameEdit === null ? (
            <button
              className="font-display text-sm text-mist-50 hover:text-pulse-300 truncate max-w-[40vw]"
              onClick={() => setNameEdit(data.wsName)}
              title="Rename workspace"
            >
              {data.wsName}
            </button>
          ) : (
            <input
              autoFocus
              className="bg-ink-800 border border-pulse-500/40 rounded-lg px-2 py-1 text-sm text-mist-50 outline-none"
              value={nameEdit}
              onChange={(e) => setNameEdit(e.target.value)}
              onBlur={() => { data.renameWorkspace(nameEdit); setNameEdit(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { data.renameWorkspace(nameEdit); setNameEdit(null); } }}
            />
          )}
          <div className="flex-1" />
          <button onClick={() => navigate('pricing')} aria-label="Plan">
            <Badge tone={plan === 'free' ? 'gray' : 'blue'}>{planDef.label}</Badge>
          </button>
          <button
            onClick={() => navigate('settings')}
            className="w-8 h-8 grid place-items-center rounded-xl text-mist-400 hover:text-mist-50 hover:bg-white/5"
            aria-label="Settings"
          >
            <GearIcon size={18} />
          </button>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pulse-500 to-aura-500 grid place-items-center text-xs font-display text-white" title={user.name}>
            {(user.name ?? 'U')[0].toUpperCase()}
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* desktop rail */}
        <aside className="hidden md:flex flex-col w-44 shrink-0 border-r border-white/5 py-4 px-2 gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => data.setTab(t.id)}
              className={cx(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition',
                data.tab === t.id
                  ? 'bg-pulse-500/15 text-pulse-300 border border-pulse-500/20'
                  : 'text-mist-400 hover:text-mist-100 hover:bg-white/5 border border-transparent',
              )}
            >
              {t.icon}{t.label}
              {t.id === 'data' && data.sources.length > 0 && (
                <span className="ml-auto text-[10px] num text-mist-500">{data.sources.length}</span>
              )}
            </button>
          ))}
        </aside>

        <main className="flex-1 min-w-0 pb-20 md:pb-6">
          {data.tab === 'data' && <DataPanel />}
          {data.tab === 'wizard' && <WizardPanel />}
          {data.tab === 'dashboards' && <DashboardsPanel />}
          {data.tab === 'chat' && <ChatPanel />}
          {data.tab === 'insights' && <InsightsPanel />}
          {data.tab === 'workspaces' && <WorkspacesPanel />}
        </main>
      </div>

      {/* mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-deep border-t border-white/5">
        <div className="grid grid-cols-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => data.setTab(t.id)}
              className={cx('flex flex-col items-center gap-0.5 py-2 text-[9px]',
                data.tab === t.id ? 'text-pulse-300' : 'text-mist-500')}
              aria-label={t.label}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ── Data panel ───────────────────────────────────────────────────────────────

const ACCEPT = '.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.json,.pdf,.txt,.md,.log,.js,.ts,.py,.sql,.html,.xml,.yml,.yaml';

function DataPanel() {
  const data = useData();
  const chat = useChat();
  const [url, setUrl] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = (list: FileList | null) => {
    if (list?.length) data.addFiles(Array.from(list));
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* dropzone + url */}
      <div className="grid lg:grid-cols-3 gap-4">
        <button
          className={cx(
            'lg:col-span-2 rounded-xl2 border-2 border-dashed p-8 text-center transition grid place-items-center min-h-[160px]',
            drag ? 'border-pulse-500 bg-pulse-500/10' : 'border-white/10 hover:border-pulse-500/50 hover:bg-white/[0.02]',
          )}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
          aria-label="Upload files"
        >
          <div>
            <UploadIcon className="mx-auto text-pulse-400 mb-3" size={26} />
            <p className="text-sm text-mist-50 font-medium">Drop files here, or click to browse</p>
            <p className="text-xs text-mist-500 mt-1.5">Excel · CSV · PDF · JSON · code files · text — multiple at once is fine</p>
          </div>
          <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden"
            onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        </button>

        <Card className="p-5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-mist-50 font-medium"><GlobeIcon size={16} className="text-glow-400" /> From the web</div>
            <p className="text-[11px] text-mist-500 mt-1">A page with tables, a CSV link, or a JSON API.</p>
          </div>
          <div className="flex gap-2">
            <input
              className={inputCls} placeholder="https://…" value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && url) { data.addUrl(url); setUrl(''); } }}
            />
            <Button variant="soft" disabled={!url || data.parsing} onClick={() => { data.addUrl(url); setUrl(''); }}>Fetch</Button>
          </div>
        </Card>
      </div>

      {data.parsing && (
        <Card className="p-5 flex items-center gap-3 text-sm text-mist-300">
          <Spinner /> Reading your data — profiling columns, detecting types and relations…
        </Card>
      )}

      {!data.sources.length && !data.parsing && (
        <EmptyState
          icon={<TableIcon />}
          title="Nothing here yet"
          body="Upload any file to see Insight read it, question it, and turn it into living dashboards. Or try the sample to see everything working in one click."
          action={<>
            <Button onClick={() => data.loadSample()}>Try sample data</Button>
            <Button variant="soft" onClick={() => fileRef.current?.click()}>Upload a file</Button>
          </>}
        />
      )}

      {/* sources */}
      {data.sources.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-sm text-mist-50">Sources</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.sources.map((s) => (
              <Card key={s.id} className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-ink-700 grid place-items-center text-pulse-400 shrink-0">
                  {s.kind === 'web' ? <GlobeIcon size={16} /> : <FileIcon size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-mist-50 truncate">{s.name}</div>
                  <div className="text-[11px] text-mist-500">
                    {s.kind.toUpperCase()} · {s.tableIds.length} table{s.tableIds.length !== 1 ? 's' : ''}
                    {s.sizeBytes ? ` · ${(s.sizeBytes / 1024).toFixed(0)} KB` : ''}
                    {s.textContent ? ' · text context kept' : ''}
                  </div>
                </div>
                <button
                  onClick={() => data.removeSource(s.id)}
                  className="text-mist-500 hover:text-rosex-400 p-1.5 rounded-lg hover:bg-white/5"
                  aria-label={`Remove ${s.name}`}
                >
                  <TrashIcon size={16} />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* tables + profiles */}
      {data.tables.map((t) => (
        <Card key={t.id} className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display text-sm text-mist-50">{t.name}</h3>
            <span className="text-[11px] text-mist-500 num">{t.rowCount.toLocaleString()} rows · {t.columns.length} columns</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {t.profiles.map((p) => (
              <span
                key={p.name}
                title={`${p.type} · ${p.uniqueCount} unique · ${Math.round((100 * p.nonNullCount) / Math.max(1, t.rowCount))}% filled${p.min !== undefined ? ` · ${p.min} → ${p.max}` : ''}${p.topValues?.length ? ` · top: ${p.topValues.slice(0, 3).map((v) => v.value).join(', ')}` : ''}`}
                className={cx(
                  'px-2 py-0.5 rounded-full text-[10px] border cursor-default',
                  p.isMetric ? 'border-pulse-500/40 text-pulse-300 bg-pulse-500/10'
                    : p.isDate ? 'border-aura-500/40 text-aura-400 bg-aura-500/10'
                    : p.isCategory ? 'border-glow-500/40 text-glow-400 bg-glow-500/10'
                    : p.isId ? 'border-amberx-400/40 text-amberx-400 bg-amberx-400/10'
                    : 'border-white/10 text-mist-400',
                )}
              >
                {p.name}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto mt-3 rounded-xl border border-white/5">
            <table className="w-full text-[11px]">
              <thead><tr className="bg-ink-800/80 text-mist-400">
                {t.columns.slice(0, 8).map((c) => <th key={c} className="px-2.5 py-1.5 text-left font-medium whitespace-nowrap">{c}</th>)}
              </tr></thead>
              <tbody>
                {t.rows.slice(0, 5).map((r, ri) => (
                  <tr key={ri} className={ri % 2 ? 'bg-white/[0.02]' : ''}>
                    {r.slice(0, 8).map((v, ci) => (
                      <td key={ci} className="px-2.5 py-1.5 text-mist-300 whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis">
                        {v === null ? <span className="text-mist-600">—</span> : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {/* relations */}
      {data.relations.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display text-sm text-mist-50 flex items-center gap-2"><LinkIcon size={16} className="text-glow-400" /> Detected relations</h3>
          <div className="mt-3 space-y-2">
            {data.relations.map((r) => {
              const from = data.tables.find((t) => t.id === r.fromTableId);
              const to = data.tables.find((t) => t.id === r.toTableId);
              return (
                <div key={r.id} className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="text-mist-50">{from?.name}.<b>{r.fromColumn}</b></span>
                  <span className="text-pulse-400">→</span>
                  <span className="text-mist-50">{to?.name}.<b>{r.toColumn}</b></span>
                  <Badge tone="gray">{r.kind}</Badge>
                  <span className="flex items-center gap-1.5 text-mist-500">
                    <span className="inline-block h-1 w-16 rounded-full bg-white/5 overflow-hidden">
                      <span className="block h-full bg-glow-500" style={{ width: `${r.matchRate * 100}%` }} />
                    </span>
                    {Math.round(r.matchRate * 100)}% match
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {data.tables.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => data.startWizard()}>
            <WandIcon size={16} /> {data.intent ? 'Refine questions' : 'Answer questions & build dashboards'}
          </Button>
          {data.dashboards.length > 0 && (
            <Button variant="soft" onClick={() => data.setTab('dashboards')}><ChartIcon size={16} /> Open dashboards</Button>
          )}
          <Button variant="ghost" onClick={() => { data.setTab('chat'); setTimeout(() => chat.ask('Describe my data'), 50); }}>
            Ask the analyst about this data
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Wizard panel ─────────────────────────────────────────────────────────────

function WizardPanel() {
  const data = useData();
  const [answers, setAnswers] = useState<WizardAnswers>({});
  const qs = data.wizardQuestions;
  const step = data.wizardStep;
  const q = qs[step];

  useEffect(() => {
    // seed defaults once questions arrive
    if (qs.length) {
      const seeded: WizardAnswers = {};
      for (const question of qs) if (question.defaultAnswer) seeded[question.id] = question.defaultAnswer;
      setAnswers((prev) => ({ ...seeded, ...prev }));
    }
  }, [qs]);

  if (!data.tables.length) {
    return <EmptyState icon={<WandIcon />} title="No data yet" body="Upload a file first — then Insight will know what to ask." action={<Button onClick={() => data.setTab('data')}>Go to Data</Button>} />;
  }
  if (data.generating) {
    return (
      <div className="max-w-xl mx-auto p-6 pt-20 text-center space-y-4">
        <Spinner size={28} />
        <p className="font-display text-mist-50">Designing your dashboards…</p>
        <p className="text-xs text-mist-400">
          Profiling {data.tables.reduce((a, t) => a + t.rowCount, 0).toLocaleString()} rows ·
          linking {data.tables.length} table{data.tables.length > 1 ? 's' : ''} · choosing widgets
        </p>
        <div className="space-y-2 pt-4">
          <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
        </div>
      </div>
    );
  }
  if (!qs.length || !q) {
    return <EmptyState icon={<WandIcon />} title="Ready when you are" body="Start the short questionnaire — it shapes your dashboards around what you actually need." action={<Button onClick={() => data.startWizard()}>Start questions</Button>} />;
  }

  const chosen = answers[q.id] ?? [];
  const toggle = (optId: string) => {
    setAnswers((a) => {
      const cur = a[q.id] ?? [];
      if (q.kind === 'multi') {
        return { ...a, [q.id]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
      }
      return { ...a, [q.id]: [optId] };
    });
  };
  const last = step === qs.length - 1;

  return (
    <div className="max-w-xl mx-auto p-5 pt-10 anim-fade-up" key={q.id}>
      {/* progress dots */}
      <div className="flex gap-1.5 justify-center mb-8">
        {qs.map((_, i) => (
          <span key={i} className={cx('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-pulse-500' : 'w-1.5 bg-white/15')} />
        ))}
      </div>
      <h2 className="font-display text-xl text-mist-50 text-center">{q.text}</h2>
      <p className="text-xs text-mist-400 text-center mt-2 max-w-md mx-auto">{q.why}</p>

      <div className="mt-7 space-y-2 max-h-[46vh] overflow-y-auto pr-1">
        {(q.options ?? []).map((o) => {
          const on = chosen.includes(o.id);
          return (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              className={cx(
                'w-full text-left glass rounded-xl px-4 py-3 transition flex items-center gap-3',
                on ? 'border-pulse-500/60 ring-1 ring-pulse-500/40' : 'hover:border-white/15',
              )}
            >
              <span className={cx(
                'w-4 h-4 shrink-0 grid place-items-center border text-[9px]',
                q.kind === 'multi' ? 'rounded' : 'rounded-full',
                on ? 'bg-pulse-500 border-pulse-500 text-white' : 'border-white/20 text-transparent',
              )}>✓</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-mist-50">{o.label}</span>
                {o.hint && <span className="block text-[11px] text-mist-500 truncate">{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-8">
        <Button variant="ghost" disabled={step === 0} onClick={() => data.setWizardStep(step - 1)}>Back</Button>
        <div className="flex gap-2">
          {q.optional && (
            <Button variant="ghost" onClick={() => (last ? data.applyWizard(answers) : data.setWizardStep(step + 1))}>Skip</Button>
          )}
          <Button
            disabled={!chosen.length && !q.optional}
            onClick={() => (last ? data.applyWizard(answers) : data.setWizardStep(step + 1))}
          >
            {last ? 'Build my dashboards' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Workspaces panel ─────────────────────────────────────────────────────────

function WorkspacesPanel() {
  const data = useData();
  const askConfirm = useApp((s) => s.askConfirm);
  useEffect(() => { data.refreshList(); }, []);
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-lg text-mist-50">Workspaces</h2>
        <Button variant="soft" onClick={() => { data.newWorkspace(); data.setTab('data'); }}>
          New workspace
        </Button>
      </div>
      {!data.workspaceList.length ? (
        <EmptyState icon={<FolderIcon />} title="No saved workspaces" body="Workspaces save automatically (encrypted) once you add data. They'll appear here." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {data.workspaceList.map((w) => (
            <Card key={w.id} className={cx('p-4', w.id === data.wsId && 'ring-1 ring-pulse-500/40')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-mist-50 truncate">{w.name}</div>
                  <div className="text-[11px] text-mist-500 mt-0.5 num">
                    {w.sourceCount} source{w.sourceCount !== 1 ? 's' : ''} · {w.rowCount.toLocaleString()} rows ·
                    {' '}{new Date(w.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="text-mist-500 hover:text-rosex-400 p-1 rounded-lg hover:bg-white/5 shrink-0"
                  aria-label={`Delete ${w.name}`}
                  onClick={async () => {
                    if (await askConfirm('Delete this workspace?', `"${w.name}" will be removed from this device. Exported backups are not affected.`, 'Delete', true)) {
                      data.deleteWorkspaceById(w.id);
                    }
                  }}
                >
                  <XIcon size={15} />
                </button>
              </div>
              <Button
                variant="soft" className="w-full mt-3"
                disabled={w.id === data.wsId}
                onClick={() => data.loadWorkspaceById(w.id)}
              >
                {w.id === data.wsId ? 'Currently open' : 'Open'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
