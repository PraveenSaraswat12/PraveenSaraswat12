// ─────────────────────────────────────────────────────────────────────────────
// Kithra Insight — shared contracts.
// Every module (engine, ui, security, billing) codes against these types.
// Owned by the architect; agents MUST NOT edit this file. If a change seems
// required, implement around it and flag it in your final report instead.
// ─────────────────────────────────────────────────────────────────────────────

export type Cell = string | number | boolean | null;
export type Row = Cell[];

export type ColumnType = 'number' | 'string' | 'date' | 'boolean' | 'mixed' | 'empty';

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  examples: string[];
  nonNullCount: number;
  nullCount: number;
  uniqueCount: number;
  /** numbers, or ISO strings for dates */
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  sum?: number;
  stdDev?: number;
  /** looks like an identifier / join key */
  isId: boolean;
  /** low-cardinality text → filter / group-by candidate */
  isCategory: boolean;
  isDate: boolean;
  /** numeric measure candidate (not an id-like number) */
  isMetric: boolean;
  topValues?: { value: string; count: number }[];
}

export type SourceKind = 'excel' | 'csv' | 'pdf' | 'json' | 'code' | 'web' | 'text';

export interface DataTable {
  id: string;
  name: string;
  sourceId: string;
  columns: string[];
  /** column-aligned rows; cells already coerced per profile type where safe */
  rows: Row[];
  profiles: ColumnProfile[];
  rowCount: number;
}

export interface DataSource {
  id: string;
  name: string;
  kind: SourceKind;
  addedAt: string; // ISO
  sizeBytes: number;
  tableIds: string[];
  /** narrative context for PDFs / code / web pages (used to ground the AI) */
  textContent?: string;
  meta?: Record<string, string>;
}

export interface Relation {
  id: string;
  fromTableId: string;
  fromColumn: string;
  toTableId: string;
  toColumn: string;
  kind: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';
  /** 0..1 — how confident the engine is that this is a real relation */
  confidence: number;
  /** share of from-values that exist in to-values */
  matchRate: number;
}

export interface ParseWarning { sourceName: string; message: string; }

export interface ParseOutcome {
  sources: DataSource[];
  tables: DataTable[];
  warnings: ParseWarning[];
}

// ── Clarifying-question wizard ───────────────────────────────────────────────

export interface WizardOption { id: string; label: string; hint?: string; }

export interface WizardQuestion {
  id: string;
  text: string;
  /** plain-language reason the app is asking — always shown to the user */
  why: string;
  kind: 'single' | 'multi' | 'column' | 'text';
  options?: WizardOption[];
  /** for kind 'column': which columns qualify */
  columnFilter?: 'date' | 'metric' | 'category' | 'any';
  tableId?: string;
  defaultAnswer?: string[];
  optional?: boolean;
}

/** questionId → chosen option ids / column refs ("tableId::column") / free text */
export type WizardAnswers = Record<string, string[]>;

// ── Conversational goals (the human questions asked AFTER silent ingest) ────

/** free-text answers; chips the user taps are appended into these strings */
export interface GoalAnswers { learn?: string; decide?: string; custom?: string; }

export interface GoalChips { learn: string[]; decide: string[]; custom: string[]; }

// ── Dashboard proposal (shown for approval BEFORE building) ─────────────────

export interface ProposalItem {
  id: string;
  kind: 'widget' | 'filter';
  dashboardName: string;
  title: string;
  /** one-line plain-language reason this item earns its place */
  reason: string;
  enabled: boolean;
  widget?: WidgetSpec;
  filterRef?: ColumnRef;
}

export interface DashboardProposal {
  intent: AnalysisIntent;
  /** complete pre-built specs; applying the proposal filters these by enabled items */
  dashboards: DashboardSpec[];
  items: ProposalItem[];
}

export type AggKind = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'distinct';

export interface ColumnRef { tableId: string; column: string; }

export interface AnalysisIntent {
  goal: string;
  dateColumn?: ColumnRef;
  /** aging bucket upper bounds in days, e.g. [30, 60, 90] → 0-30, 31-60, 61-90, 90+ */
  agingBuckets?: number[];
  filterColumns: ColumnRef[];
  kpis: { ref: ColumnRef; agg: AggKind }[];
  compareBy?: ColumnRef;
  currency?: string;
}

// ── Analytics query model (dashboards and chat both compile to this) ────────

export type FilterOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'in' | 'between' | 'before' | 'after';

export interface QueryFilter { column: string; op: FilterOp; value: Cell | Cell[]; }

export type TimeGrain = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface AgingSpec {
  dateColumn: string;
  /** bucket upper bounds in days */
  buckets: number[];
  /** ISO date to age against; default = today */
  asOf?: string;
}

export interface AnalyticsQuery {
  tableId: string;
  metrics: { column: string; agg: AggKind; as?: string }[];
  groupBy?: string[];
  /** when grouping by a date column */
  timeGrain?: TimeGrain;
  filters: QueryFilter[];
  sort?: { by: string; dir: 'asc' | 'desc' };
  limit?: number;
  /** bucket rows by age of dateColumn instead of normal groupBy */
  aging?: AgingSpec;
  /** add share-of-total % column for first metric */
  withShare?: boolean;
}

export interface QueryResultTable { columns: string[]; types: ColumnType[]; rows: Row[]; }

export interface QueryResult {
  table: QueryResultTable;
  /** totals row aligned to table.columns (label in first cell) */
  totals?: Row;
  meta: { tableId: string; appliedFilters: QueryFilter[]; ms: number; rowsScanned: number };
}

// ── Dashboards ───────────────────────────────────────────────────────────────

export type WidgetType =
  | 'kpi' | 'line' | 'bar' | 'stackedBar' | 'area'
  | 'pie' | 'donut' | 'table' | 'aging' | 'scatter';

export interface WidgetFormat { percent?: boolean; currency?: string; decimals?: number; }

export interface WidgetSpec {
  id: string;
  title: string;
  subtitle?: string;
  type: WidgetType;
  query: AnalyticsQuery;
  format?: WidgetFormat;
  size: 'sm' | 'md' | 'lg' | 'xl';
  /** clicking a slice/bar applies a dashboard-wide filter on this column */
  drillFilterColumn?: string;
}

export interface DashboardSpec {
  id: string;
  name: string;
  description: string;
  tableIds: string[];
  globalFilterColumns: ColumnRef[];
  dateColumn?: ColumnRef;
  widgets: WidgetSpec[];
}

/** one active cross/global filter on a dashboard */
export interface ActiveFilter { ref: ColumnRef; filter: QueryFilter; label: string; }

// ── Chat assistant ───────────────────────────────────────────────────────────

export interface ChatAttachment {
  kind: 'chart' | 'table' | 'kpi';
  widget: WidgetSpec;
  result: QueryResult;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: ChatAttachment[];
  createdAt: string;
  source?: 'local-engine' | 'cloud-ai' | 'system';
}

export interface EngineAnswer {
  text: string;
  attachments: ChatAttachment[];
  /** true when the local parser was not confident — UI may escalate to cloud AI */
  lowConfidence?: boolean;
}

// ── Auto insights ────────────────────────────────────────────────────────────

export type InsightKind =
  | 'trend' | 'outlier' | 'concentration' | 'correlation'
  | 'quality' | 'aging' | 'comparison';

export interface Insight {
  id: string;
  tableId: string;
  kind: InsightKind;
  severity: 'info' | 'good' | 'warn' | 'critical';
  title: string;
  detail: string;
  widget?: WidgetSpec;
}

// ── Workspace (what gets persisted) ─────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sources: DataSource[];
  tables: DataTable[];
  relations: Relation[];
  intent?: AnalysisIntent;
  answers?: WizardAnswers;
  goals?: GoalAnswers;
  dashboards: DashboardSpec[];
  insights: Insight[];
  chat: ChatTurn[];
  schemaVersion: 1;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  updatedAt: string;
  sourceCount: number;
  tableCount: number;
  rowCount: number;
}

// ── Plans & billing ──────────────────────────────────────────────────────────

export type PlanId = 'free' | 'pro' | 'premium' | 'enterprise';

export interface PlanLimits {
  /** -1 = unlimited */
  maxSources: number;
  maxFileMB: number;
  maxRowsPerTable: number;
  aiQuestionsPerDay: number;
  cloudAI: boolean;
  exports: boolean;
  /** what-if scenarios + forecast tools */
  scenarios: boolean;
  maxWorkspaces: number;
}

export interface PlanDef {
  id: PlanId;
  label: string;
  tagline: string;
  monthlyUSD: number | null; // null = contact sales
  yearlyUSD: number | null;
  /** plan id understood by the existing Kithra payments edge function */
  backendPlan?: 'plus' | 'premium';
  features: string[];
  limits: PlanLimits;
  highlight?: boolean;
}

export interface Subscription {
  plan: PlanId;
  period?: 'month' | 'year';
  activeUntil?: string;
  raw?: unknown;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  provider: 'google' | 'phone' | 'guest';
}

// ── App navigation (hash-routed views) ───────────────────────────────────────

export type ViewId =
  | 'landing' | 'auth' | 'studio' | 'pricing'
  | 'settings' | 'privacy' | 'terms' | 'security';
