// App state: navigation/toasts, auth, workspace data, chat — glue between
// the UI and the engine/security/billing modules.
import { create } from 'zustand';
import type {
  ActiveFilter, AnalyticsQuery, ChatTurn, DashboardSpec, DataSource, DataTable,
  Insight, PlanId, QueryFilter, Relation, SessionUser, ViewId, WidgetSpec,
  WizardAnswers, WizardQuestion, Workspace, WorkspaceSummary, AnalysisIntent,
} from '../../contracts/types';
import { engine, uid } from '../../engine';
import { security } from '../../security';
import { billing } from '../../billing';
import { cloudAI } from '../../platform/cloud';

// ── navigation + toasts ──────────────────────────────────────────────────────

export interface Toast { id: string; kind: 'info' | 'success' | 'warn' | 'error'; text: string; }

const HASH_TO_VIEW: Record<string, ViewId> = {
  '': 'landing', '#/': 'landing', '#/auth': 'auth', '#/studio': 'studio',
  '#/pricing': 'pricing', '#/settings': 'settings', '#/privacy': 'privacy',
  '#/terms': 'terms', '#/security': 'security',
};

interface ConfirmState {
  title: string; body: string; confirmLabel: string; danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface AppState {
  view: ViewId;
  toasts: Toast[];
  confirm: ConfirmState | null;
  navigate(v: ViewId): void;
  syncFromHash(): void;
  toast(kind: Toast['kind'], text: string): void;
  dismissToast(id: string): void;
  askConfirm(title: string, body: string, confirmLabel?: string, danger?: boolean): Promise<boolean>;
  resolveConfirm(ok: boolean): void;
}

export const useApp = create<AppState>((set, get) => ({
  view: HASH_TO_VIEW[typeof location !== 'undefined' ? location.hash : ''] ?? 'landing',
  toasts: [],
  confirm: null,
  navigate(v) {
    const hash = v === 'landing' ? '#/' : `#/${v}`;
    if (typeof location !== 'undefined' && location.hash !== hash) location.hash = hash;
    set({ view: v });
  },
  syncFromHash() {
    set({ view: HASH_TO_VIEW[location.hash] ?? 'landing' });
  },
  toast(kind, text) {
    const id = uid('toast');
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
    setTimeout(() => get().dismissToast(id), 4500);
  },
  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  askConfirm(title, body, confirmLabel = 'Confirm', danger) {
    return new Promise<boolean>((resolve) => {
      set({ confirm: { title, body, confirmLabel, danger, resolve } });
    });
  },
  resolveConfirm(ok) {
    get().confirm?.resolve(ok);
    set({ confirm: null });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => useApp.getState().syncFromHash());
}

// ── auth ─────────────────────────────────────────────────────────────────────

interface AuthState {
  user: SessionUser | null;
  plan: PlanId;
  booted: boolean;
  init(): Promise<void>;
  google(): Promise<void>;
  sendOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<void>;
  guest(name?: string): Promise<void>;
  signOut(): Promise<void>;
}

let authInited = false;

export const useAuth = create<AuthState>((set) => ({
  user: null,
  plan: billing.currentPlan(),
  booted: false,
  async init() {
    if (authInited) return;
    authInited = true;
    security.onAuthChange((u) => {
      set({ user: u });
      if (u && u.provider !== 'guest') billing.refreshSubscription().catch(() => {});
    });
    billing.onPlanChange((plan) => set({ plan }));
    const cameFromOAuth = typeof location !== 'undefined' && /access_token|code=/.test(location.hash + location.search);
    const u = await security.init();
    set({ user: u, booted: true, plan: billing.currentPlan() });
    if (u && u.provider !== 'guest') {
      billing.refreshSubscription().then(() => set({ plan: billing.currentPlan() })).catch(() => {});
    }
    if (u && cameFromOAuth) {
      // returning from Google sign-in: clean the token hash, land in the studio
      try { history.replaceState(null, '', location.pathname + location.search); } catch { /* fine */ }
      useApp.getState().navigate('studio');
    }
  },
  async google() { await security.signInWithGoogle(); },
  async sendOtp(phone) { await security.sendPhoneOtp(phone); },
  async verifyOtp(phone, code) {
    await security.verifyPhoneOtp(phone, code);
    useApp.getState().navigate('studio');
  },
  async guest(name) {
    await security.continueAsGuest(name);
    useApp.getState().navigate('studio');
  },
  async signOut() {
    await security.signOut();
    useApp.getState().navigate('landing');
  },
}));

// ── workspace data ───────────────────────────────────────────────────────────

export type StudioTab = 'data' | 'wizard' | 'dashboards' | 'chat' | 'insights' | 'workspaces';

interface DataState {
  wsId: string;
  wsName: string;
  createdAt: string;
  sources: DataSource[];
  tables: DataTable[];
  relations: Relation[];
  intent?: AnalysisIntent;
  answers?: WizardAnswers;
  dashboards: DashboardSpec[];
  insights: Insight[];
  chat: ChatTurn[];

  tab: StudioTab;
  parsing: boolean;
  generating: boolean;
  wizardQuestions: WizardQuestion[];
  wizardStep: number;
  activeDashboardId: string | null;
  activeFilters: ActiveFilter[];
  workspaceList: WorkspaceSummary[];

  setTab(tab: StudioTab): void;
  newWorkspace(): void;
  addFiles(files: File[]): Promise<void>;
  addUrl(url: string): Promise<void>;
  loadSample(): Promise<void>;
  removeSource(id: string): void;
  startWizard(): void;
  setWizardStep(n: number): void;
  applyWizard(answers: WizardAnswers): Promise<void>;
  regenerate(): void;
  setActiveDashboard(id: string): void;
  setFilter(f: ActiveFilter): void;
  removeFilter(idx: number): void;
  clearFilters(): void;
  crossFilter(w: WidgetSpec, label: string): void;
  mergedQuery(w: WidgetSpec): AnalyticsQuery;
  pinWidget(w: WidgetSpec): void;
  addWidget(w: WidgetSpec): void;
  removeWidget(dashId: string, widgetId: string): void;
  renameWorkspace(name: string): void;
  refreshList(): Promise<void>;
  loadWorkspaceById(id: string): Promise<void>;
  deleteWorkspaceById(id: string): Promise<void>;
  toWorkspace(): Workspace;
  persistSoon(): void;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useData = create<DataState>((set, get) => ({
  wsId: uid('ws'),
  wsName: 'My analysis',
  createdAt: new Date().toISOString(),
  sources: [], tables: [], relations: [],
  intent: undefined, answers: undefined,
  dashboards: [], insights: [], chat: [],

  tab: 'data',
  parsing: false,
  generating: false,
  wizardQuestions: [],
  wizardStep: 0,
  activeDashboardId: null,
  activeFilters: [],
  workspaceList: [],

  setTab(tab) { set({ tab }); },

  newWorkspace() {
    set({
      wsId: uid('ws'), wsName: 'My analysis', createdAt: new Date().toISOString(),
      sources: [], tables: [], relations: [], intent: undefined, answers: undefined,
      dashboards: [], insights: [], chat: [], tab: 'data',
      wizardQuestions: [], wizardStep: 0, activeDashboardId: null, activeFilters: [],
    });
  },

  async addFiles(files) {
    const { toast } = useApp.getState();
    const allowed: File[] = [];
    let count = get().sources.length;
    for (const f of files) {
      const gate = billing.canAddSource(count, f.size / (1024 * 1024));
      if (!gate.ok) { toast('warn', gate.reason!); break; }
      allowed.push(f); count++;
    }
    if (!allowed.length) return;
    set({ parsing: true });
    try {
      const out = await engine.parseFiles(allowed);
      ingest(out.sources, out.tables, out.warnings);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Could not read those files');
    } finally {
      set({ parsing: false });
    }
  },

  async addUrl(url) {
    const { toast } = useApp.getState();
    const gate = billing.canAddSource(get().sources.length, 0.1);
    if (!gate.ok) { toast('warn', gate.reason!); return; }
    set({ parsing: true });
    try {
      const out = await engine.parseWebUrl(url);
      ingest(out.sources, out.tables, out.warnings);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Could not read that link');
    } finally {
      set({ parsing: false });
    }
  },

  async loadSample() {
    const { loadSampleFiles } = await import('../sample');
    await get().addFiles(loadSampleFiles());
  },

  removeSource(id) {
    const s = get();
    const tables = s.tables.filter((t) => t.sourceId !== id);
    const tableIds = new Set(tables.map((t) => t.id));
    const relations = engine.detectRelations(tables);
    set({
      sources: s.sources.filter((x) => x.id !== id),
      tables, relations,
      activeFilters: s.activeFilters.filter((f) => tableIds.has(f.ref.tableId)),
    });
    if (s.intent) get().regenerate();
    get().persistSoon();
  },

  startWizard() {
    const s = get();
    const questions = engine.buildWizard(s.tables, s.relations);
    set({ wizardQuestions: questions, wizardStep: 0, tab: 'wizard' });
  },

  setWizardStep(n) { set({ wizardStep: n }); },

  async applyWizard(answers) {
    const s = get();
    set({ generating: true, answers });
    await new Promise((r) => setTimeout(r, 30)); // let the spinner paint
    try {
      const intent = engine.buildIntent(s.tables, answers, s.wizardQuestions);
      const dashboards = engine.buildDashboards(s.tables, s.relations, intent);
      const insights = engine.generateInsights(s.tables, s.relations, intent);
      set({
        intent, dashboards, insights,
        activeDashboardId: dashboards[0]?.id ?? null,
        tab: 'dashboards',
      });
      get().persistSoon();
    } finally {
      set({ generating: false });
    }
  },

  regenerate() {
    const s = get();
    if (!s.intent) return;
    const dashboards = engine.buildDashboards(s.tables, s.relations, s.intent);
    const insights = engine.generateInsights(s.tables, s.relations, s.intent);
    const keep = dashboards.find((d) => d.id === s.activeDashboardId);
    set({ dashboards, insights, activeDashboardId: keep?.id ?? dashboards[0]?.id ?? null });
    get().persistSoon();
  },

  setActiveDashboard(id) { set({ activeDashboardId: id, activeFilters: [] }); },

  setFilter(f) {
    set((s) => {
      const others = s.activeFilters.filter(
        (x) => !(x.ref.column === f.ref.column && x.ref.tableId === f.ref.tableId),
      );
      return { activeFilters: [...others, f] };
    });
  },

  removeFilter(idx) {
    set((s) => ({ activeFilters: s.activeFilters.filter((_, i) => i !== idx) }));
  },

  clearFilters() { set({ activeFilters: [] }); },

  crossFilter(w, label) {
    const col = w.drillFilterColumn;
    if (!col) return;
    const s = get();
    const existing = s.activeFilters.find(
      (f) => f.ref.column === col && String(f.filter.value) === label,
    );
    if (existing) {
      set({ activeFilters: s.activeFilters.filter((f) => f !== existing) });
    } else {
      get().setFilter({
        ref: { tableId: w.query.tableId, column: col },
        filter: { column: col, op: 'eq', value: label },
        label: `${col}: ${label}`,
      });
    }
  },

  /** widget query + dashboard filters that apply to its table (by column name) */
  mergedQuery(w) {
    const s = get();
    const t = s.tables.find((x) => x.id === w.query.tableId);
    if (!t || !s.activeFilters.length) return w.query;
    const extra: QueryFilter[] = [];
    for (const f of s.activeFilters) {
      const has = t.columns.some((c) => c.toLowerCase() === f.filter.column.toLowerCase());
      if (has) extra.push(f.filter);
    }
    if (!extra.length) return w.query;
    return { ...w.query, filters: [...(w.query.filters || []), ...extra] };
  },

  pinWidget(w) {
    const s = get();
    const dash = s.dashboards.find((d) => d.id === s.activeDashboardId) ?? s.dashboards[0];
    if (!dash) { useApp.getState().toast('warn', 'Build a dashboard first, then pin charts to it.'); return; }
    get().addWidget({ ...w, id: uid('w'), size: w.size === 'sm' ? 'sm' : 'md' });
    useApp.getState().toast('success', `Pinned to ${dash.name}`);
  },

  addWidget(w) {
    set((s) => ({
      dashboards: s.dashboards.map((d) =>
        d.id === (s.activeDashboardId ?? s.dashboards[0]?.id) ? { ...d, widgets: [...d.widgets, w] } : d,
      ),
    }));
    get().persistSoon();
  },

  removeWidget(dashId, widgetId) {
    set((s) => ({
      dashboards: s.dashboards.map((d) =>
        d.id === dashId ? { ...d, widgets: d.widgets.filter((w) => w.id !== widgetId) } : d,
      ),
    }));
    get().persistSoon();
  },

  renameWorkspace(name) {
    set({ wsName: name.trim() || 'My analysis' });
    get().persistSoon();
  },

  async refreshList() {
    try { set({ workspaceList: await security.listWorkspaces() }); } catch { /* fresh device */ }
  },

  async loadWorkspaceById(id) {
    const ws = await security.loadWorkspace(id);
    if (!ws) { useApp.getState().toast('error', 'Could not open that workspace.'); return; }
    set({
      wsId: ws.id, wsName: ws.name, createdAt: ws.createdAt,
      sources: ws.sources, tables: ws.tables, relations: ws.relations,
      intent: ws.intent, answers: ws.answers,
      dashboards: ws.dashboards, insights: ws.insights, chat: ws.chat,
      activeDashboardId: ws.dashboards[0]?.id ?? null,
      activeFilters: [],
      tab: ws.dashboards.length ? 'dashboards' : 'data',
      wizardQuestions: [], wizardStep: 0,
    });
  },

  async deleteWorkspaceById(id) {
    await security.deleteWorkspace(id);
    await get().refreshList();
  },

  toWorkspace(): Workspace {
    const s = get();
    return {
      id: s.wsId, name: s.wsName, createdAt: s.createdAt,
      updatedAt: new Date().toISOString(),
      sources: s.sources, tables: s.tables, relations: s.relations,
      intent: s.intent, answers: s.answers,
      dashboards: s.dashboards, insights: s.insights,
      chat: s.chat.slice(-100),
      schemaVersion: 1,
    };
  },

  persistSoon() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const s = get();
      if (s.parsing || !s.sources.length) return;
      security.saveWorkspace(s.toWorkspace()).then(
        () => get().refreshList(),
        (e) => useApp.getState().toast('warn', e instanceof Error ? e.message : 'Could not save locally'),
      );
    }, 800);
  },
}));

function ingest(sources: DataSource[], tables: DataTable[], warnings: { sourceName: string; message: string }[]) {
  const { toast } = useApp.getState();
  const st = useData.getState();
  for (const w of warnings) toast('warn', `${w.sourceName}: ${w.message}`);
  if (!sources.length && !tables.length) return;
  const allTables = [...st.tables, ...tables];
  const relations = engine.detectRelations(allTables);
  useData.setState({
    sources: [...st.sources, ...sources],
    tables: allTables,
    relations,
  });
  const gotData = tables.length > 0;
  if (gotData && !st.intent) {
    useData.getState().startWizard();
  } else if (gotData && st.intent) {
    useData.getState().regenerate();
    toast('success', `Added ${tables.length} table${tables.length > 1 ? 's' : ''} — dashboards refreshed.`);
  } else if (!gotData) {
    toast('info', 'No tables found, but the text was kept as context for the AI analyst.');
  }
  useData.getState().persistSoon();
}

// ── chat ─────────────────────────────────────────────────────────────────────

interface ChatState {
  busy: boolean;
  ask(text: string): Promise<void>;
  suggestions(): string[];
}

export const useChat = create<ChatState>((set) => ({
  busy: false,

  async ask(text) {
    const q = text.trim();
    if (!q) return;
    const app = useApp.getState();
    const gate = billing.canAskAI();
    if (!gate.ok) { app.toast('warn', gate.reason!); return; }

    const data = useData.getState();
    const userTurn: ChatTurn = { id: uid('c'), role: 'user', text: q, createdAt: new Date().toISOString() };
    useData.setState({ chat: [...data.chat, userTurn] });
    set({ busy: true });
    billing.recordAIQuestion();

    try {
      const ctx = {
        tables: data.tables, relations: data.relations, intent: data.intent,
        history: data.chat.slice(-12),
      };
      const local = await engine.answer(q, ctx);
      let finalText = local.text;
      let source: ChatTurn['source'] = 'local-engine';

      const user = useAuth.getState().user;
      if (
        local.lowConfidence && billing.canUseCloudAI() && security.getCloudConsent() &&
        user && user.provider !== 'guest'
      ) {
        try {
          const brief = engine.describeDataForAI(ctx, q);
          const cloudText = await cloudAI(
            `${q}\n\nDATA FACTS (computed locally, trustworthy):\n${brief}`,
            "You are Kithra Insight's data analyst. Answer ONLY from the provided data facts. Be concise and numeric. If the facts are insufficient, say exactly what to upload or compute next. Never invent numbers.",
          );
          if (cloudText && cloudText.trim()) { finalText = cloudText.trim(); source = 'cloud-ai'; }
        } catch { /* cloud is optional — local answer stands */ }
      }

      const turn: ChatTurn = {
        id: uid('c'), role: 'assistant', text: finalText,
        attachments: local.attachments, createdAt: new Date().toISOString(), source,
      };
      useData.setState((s) => ({ chat: [...s.chat, turn] }));
      useData.getState().persistSoon();
    } catch (e) {
      const turn: ChatTurn = {
        id: uid('c'), role: 'assistant',
        text: `Something went wrong: ${e instanceof Error ? e.message : 'unknown error'}`,
        createdAt: new Date().toISOString(), source: 'system',
      };
      useData.setState((s) => ({ chat: [...s.chat, turn] }));
    } finally {
      set({ busy: false });
    }
  },

  suggestions() {
    const { tables, intent } = useData.getState();
    const out: string[] = [];
    const t = tables[0];
    if (!t) return ['Upload a file to get started'];
    const metric = intent?.kpis[0]?.ref.column ?? t.profiles.find((p) => p.isMetric)?.name;
    const cat = intent?.compareBy?.column ?? t.profiles.find((p) => p.isCategory)?.name;
    const date = intent?.dateColumn?.column ?? t.profiles.find((p) => p.isDate)?.name;
    if (metric && cat) out.push(`Total ${metric} by ${cat}`);
    if (metric && date) out.push(`Monthly trend of ${metric}`);
    if (cat) out.push(`Top 10 ${cat} by ${metric ?? 'count'}`);
    if (date && metric) out.push(`Aging of ${metric}`);
    if (metric && date) out.push(`Forecast ${metric} for the next 3 months`);
    out.push('Describe my data');
    return out.slice(0, 5);
  },
}));
