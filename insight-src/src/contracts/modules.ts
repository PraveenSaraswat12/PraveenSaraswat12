// ─────────────────────────────────────────────────────────────────────────────
// Module API contracts. Each module exports a singleton implementing its
// interface from its index.ts:
//   src/engine/index.ts   → export const engine: InsightEngine
//   src/security/index.ts → export const security: SecurityModule
//   src/billing/index.ts  → export const billing: BillingModule
// UI imports ONLY these entry points (plus contracts/ and platform/).
// Owned by the architect; agents MUST NOT edit this file.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AnalyticsQuery, AnalysisIntent, ChatTurn, DashboardProposal, DashboardSpec,
  DataSource, DataTable, EngineAnswer, GoalAnswers, GoalChips, Insight,
  ParseOutcome, PlanDef, PlanId, QueryResult, Relation, SessionUser,
  Subscription, WizardAnswers, WizardQuestion, Workspace, WorkspaceSummary,
} from './types';

// ── Engine (pure data logic; no React, no persistent state) ─────────────────

export interface EngineContext {
  tables: DataTable[];
  relations: Relation[];
  intent?: AnalysisIntent;
}

export interface AnswerContext extends EngineContext {
  history: ChatTurn[];
  /** today's date ISO (injectable for tests) */
  today?: string;
}

export interface InsightEngine {
  /** Excel/CSV/PDF/JSON/code/text files → tables + narrative context */
  parseFiles(files: File[]): Promise<ParseOutcome>;
  /** fetch a public web page / API url and extract tables + text */
  parseWebUrl(url: string): Promise<ParseOutcome>;
  detectRelations(tables: DataTable[]): Relation[];
  /** power-user "Refine" questionnaire (column-level; optional) */
  buildWizard(tables: DataTable[], relations: Relation[]): WizardQuestion[];
  buildIntent(tables: DataTable[], answers: WizardAnswers, questions: WizardQuestion[]): AnalysisIntent;
  /** tappable suggestions for the three human questions, from the actual data */
  suggestGoalChips(tables: DataTable[], relations: Relation[]): GoalChips;
  /** plain-language answers → full intent (columns/dates/aging chosen automatically) */
  buildIntentFromGoals(tables: DataTable[], relations: Relation[], goals: GoalAnswers): AnalysisIntent;
  /** the approval plan: what the dashboards WILL contain, with reasons */
  proposeDashboards(tables: DataTable[], relations: Relation[], intent: AnalysisIntent): DashboardProposal;
  buildDashboards(tables: DataTable[], relations: Relation[], intent: AnalysisIntent): DashboardSpec[];
  runQuery(q: AnalyticsQuery, ctx: EngineContext): QueryResult;
  generateInsights(tables: DataTable[], relations: Relation[], intent?: AnalysisIntent): Insight[];
  /** deterministic natural-language analytics (no network) */
  answer(question: string, ctx: AnswerContext): Promise<EngineAnswer>;
  /** compact, factual summary of the data — context for the cloud AI */
  describeDataForAI(ctx: EngineContext, focusQuestion?: string): string;
}

// ── Security / storage / auth ────────────────────────────────────────────────

export type AuthListener = (user: SessionUser | null) => void;

export interface SecurityModule {
  /** restore persisted session (call once at boot) */
  init(): Promise<SessionUser | null>;
  currentUser(): SessionUser | null;
  onAuthChange(cb: AuthListener): () => void;
  signInWithGoogle(): Promise<void>;
  sendPhoneOtp(phone: string): Promise<void>;
  verifyPhoneOtp(phone: string, token: string): Promise<SessionUser>;
  /** local-only guest account (no cloud) */
  continueAsGuest(name?: string): Promise<SessionUser>;
  signOut(): Promise<void>;

  /** encrypted-at-rest workspace persistence (IndexedDB, AES-256-GCM) */
  saveWorkspace(ws: Workspace): Promise<void>;
  loadWorkspace(id: string): Promise<Workspace | null>;
  listWorkspaces(): Promise<WorkspaceSummary[]>;
  deleteWorkspace(id: string): Promise<void>;
  /** encrypted portable backup (.kithra file) */
  exportWorkspace(ws: Workspace, passphrase: string): Promise<Blob>;
  importWorkspace(file: File, passphrase: string): Promise<Workspace>;

  /** consent for sending data summaries to cloud AI (per Kithra precedent) */
  getCloudConsent(): boolean;
  setCloudConsent(v: boolean): void;

  /** separate consent: encrypted workspace backup to the Kithra cloud */
  getCloudSync(): boolean;
  setCloudSync(v: boolean): void;
  /** true when signed in AND the insight_workspaces table exists */
  cloudAvailable(): Promise<boolean>;
  cloudSaveWorkspace(ws: Workspace): Promise<void>;
  cloudListWorkspaces(): Promise<WorkspaceSummary[]>;
  cloudLoadWorkspace(id: string): Promise<Workspace | null>;
  cloudDeleteWorkspace(id: string): Promise<void>;
  cloudDeleteAll(): Promise<void>;

  /** wipe every locally stored byte (datasets, sessions, counters) */
  eraseAllLocalData(): Promise<void>;
}

// ── Billing / plans / entitlements ───────────────────────────────────────────

export interface CheckoutResult {
  ok: boolean;
  /** 'paid' via Razorpay, 'demo' when payments backend is unreachable */
  mode: 'paid' | 'demo';
  message: string;
}

export interface UsageToday { aiQuestions: number; }

export interface BillingModule {
  plans(): PlanDef[];
  plan(id: PlanId): PlanDef;
  /** current effective plan (subscription if signed in, else stored/demo) */
  currentPlan(): PlanId;
  refreshSubscription(): Promise<Subscription | null>;
  /** opens Razorpay checkout (cards / UPI / netbanking / wallets) */
  checkout(planId: PlanId, period: 'month' | 'year'): Promise<CheckoutResult>;
  onPlanChange(cb: (plan: PlanId) => void): () => void;

  // entitlement checks the UI must enforce
  canAddSource(currentCount: number, fileMB: number): { ok: boolean; reason?: string };
  canAskAI(): { ok: boolean; reason?: string };
  recordAIQuestion(): void;
  usageToday(): UsageToday;
  canUseCloudAI(): boolean;
  canExport(): boolean;
  canUseScenarios(): boolean;
}
