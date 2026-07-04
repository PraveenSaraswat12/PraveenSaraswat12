// QA: engine unit tests on a synthetic sales fixture.
import { describe, expect, it } from 'vitest';
import type { DataTable } from '../../contracts/types';
import { engine } from '../index';
import { profileTable, gridToTable } from '../profile';
import { runQuery, agingBucketLabels, truncateDate } from '../query';
import { parseDateLoose, excelSerialToDate, parseNumberLoose, fmtNum } from '../util';
import { detectRelations } from '../relations';
import { buildWizard, buildIntent } from '../wizard';
import { buildDashboards } from '../dashboards';
import { generateInsights } from '../insights';
import { parseFiles } from '../io/files';
import { parseWebUrl, __setWebFetchForTests } from '../io/web';

// ── fixture ──────────────────────────────────────────────────────────────────

const ORDERS_CSV = [
  'order_id,order_date,customer_id,region,category,units,unit_price,revenue,status,due_date',
  'O1,2026-01-05,C01,West,Electronics,10,100,1000,Paid,2026-02-05',
  'O2,2026-01-15,C02,West,Apparel,5,200,1000,Paid,2026-02-15',
  'O3,2026-02-03,C01,West,Electronics,20,100,2000,Pending,2026-03-03',
  'O4,2026-02-20,C03,North,Home,4,250,1000,Overdue,2026-01-20',
  'O5,2026-03-10,C02,South,Apparel,8,150,1200,Paid,2026-04-10',
  'O6,2026-03-22,C04,East,Beauty,2,500,1000,Overdue,2026-02-22',
  'O7,2026-04-02,C01,West,Electronics,30,110,3300,Paid,2026-05-02',
  'O8,2026-04-18,C05,North,Home,6,200,1200,Pending,2026-05-18',
  'O9,2026-05-06,C02,West,Apparel,12,160,1920,Paid,2026-06-06',
  'O10,2026-05-21,C03,South,Electronics,15,120,1800,Overdue,2026-03-21',
  'O11,2026-06-01,C04,West,Beauty,3,400,1200,Pending,2026-07-01',
  'O12,2026-06-08,C05,East,Home,9,180,1620,Paid,2026-07-08',
].join('\n');

const CUSTOMERS_CSV = [
  'customer_id,customer_name,city,segment',
  'C01,Apex Traders,Mumbai,Enterprise',
  'C02,Bluewave,Delhi,SMB',
  'C03,Crystal,Pune,SMB',
  'C04,Deccan,Chennai,Consumer',
  'C05,Everest,Jaipur,Enterprise',
].join('\n');

async function loadFixture(): Promise<{ orders: DataTable; customers: DataTable; tables: DataTable[] }> {
  const out = await parseFiles([
    new File([ORDERS_CSV], 'orders.csv', { type: 'text/csv' }),
    new File([CUSTOMERS_CSV], 'customers.csv', { type: 'text/csv' }),
  ]);
  const orders = out.tables.find((t) => t.name.includes('orders'))!;
  const customers = out.tables.find((t) => t.name.includes('customers'))!;
  return { orders, customers, tables: out.tables };
}

const TODAY = '2026-06-13';

// ── util ─────────────────────────────────────────────────────────────────────

describe('util parsing', () => {
  it('parses loose numbers', () => {
    expect(parseNumberLoose('₹1,23,456.78')?.value).toBeCloseTo(123456.78);
    expect(parseNumberLoose('(500)')?.value).toBe(-500);
    expect(parseNumberLoose('45%')?.percent).toBe(true);
    expect(parseNumberLoose('abc')).toBeNull();
    expect(parseNumberLoose('$1,200')?.currency).toBe('$');
  });
  it('parses dates in many formats', () => {
    expect(parseDateLoose('2026-03-05')?.iso).toBe('2026-03-05');
    expect(parseDateLoose('05/03/2026', true)?.iso).toBe('2026-03-05');
    expect(parseDateLoose('03/05/2026', false)?.iso).toBe('2026-03-05');
    expect(parseDateLoose('13/05/2026', false)?.iso).toBe('2026-05-13'); // self-corrects
    expect(parseDateLoose('5-Mar-26')?.iso).toBe('2026-03-05');
    expect(parseDateLoose('Mar 5, 2026')?.iso).toBe('2026-03-05');
    expect(parseDateLoose('not a date')).toBeNull();
  });
  it('converts Excel serial dates', () => {
    expect(excelSerialToDate(45000)?.iso).toBe('2023-03-15');
  });
  it('formats numbers compactly', () => {
    expect(fmtNum(4214567)).toBe('4.2M');
    expect(fmtNum(1234, { currency: '₹' })).toBe('₹1234');
    expect(fmtNum(34.53, { percent: true })).toBe('34.5%');
  });
});

// ── profiling ────────────────────────────────────────────────────────────────

describe('profiling', () => {
  it('detects headers and synthesizes when missing', () => {
    const withHeader = gridToTable([['name', 'amount'], ['a', 1], ['b', 2]]);
    expect(withHeader.columns).toEqual(['name', 'amount']);
    expect(withHeader.rows).toHaveLength(2);
    const dupes = gridToTable([['x', 'x'], ['1', '2']]);
    expect(dupes.columns[1]).toBe('x (2)');
  });
  it('infers types, ids, categories, metrics', async () => {
    const { orders } = await loadFixture();
    const by = Object.fromEntries(orders.profiles.map((p) => [p.name, p]));
    expect(by['order_date'].type).toBe('date');
    expect(by['revenue'].type).toBe('number');
    expect(by['revenue'].isMetric).toBe(true);
    expect(by['region'].isCategory).toBe(true);
    expect(by['order_id'].isId).toBe(true);
    expect(by['revenue'].sum).toBe(18240);
  });
  it('handles currency strings and serial dates by name hint', () => {
    const p = profileTable(['amount', 'created_date'], [
      ['₹1,000', 45000], ['₹2,500', 45001], ['₹500', 45002], ['₹3,000', 45003], ['₹100', 45004],
    ]);
    expect(p.profiles[0].type).toBe('number');
    expect(p.rows[0][0]).toBe(1000);
    expect(p.profiles[1].type).toBe('date');
    expect(String(p.rows[0][1])).toMatch(/^2023-03/);
  });
});

// ── query core ───────────────────────────────────────────────────────────────

describe('runQuery', () => {
  it('computes every aggregation', async () => {
    const { orders, tables } = await loadFixture();
    const ctx = { tables, relations: [] };
    const r = runQuery({
      tableId: orders.id,
      metrics: [
        { column: 'revenue', agg: 'sum', as: 's' }, { column: 'revenue', agg: 'avg', as: 'a' },
        { column: 'revenue', agg: 'min', as: 'mn' }, { column: 'revenue', agg: 'max', as: 'mx' },
        { column: 'revenue', agg: 'median', as: 'md' }, { column: '*', agg: 'count', as: 'c' },
        { column: 'region', agg: 'distinct', as: 'd' },
      ],
      filters: [],
    }, ctx);
    const [s, a, mn, mx, md, c, d] = r.table.rows[0] as number[];
    expect(s).toBe(18240);
    expect(c).toBe(12);
    expect(mn).toBe(1000);
    expect(mx).toBe(3300);
    expect(d).toBe(4);
    expect(a).toBeCloseTo(1520, 0);
    expect(md).toBeGreaterThan(1000);
  });

  it('filters with typed comparisons and dates', async () => {
    const { orders, tables } = await loadFixture();
    const ctx = { tables, relations: [] };
    const west = runQuery({
      tableId: orders.id, metrics: [{ column: '*', agg: 'count', as: 'c' }],
      filters: [{ column: 'region', op: 'eq', value: 'west' }],
    }, ctx);
    expect(west.table.rows[0][0]).toBe(6);
    const recent = runQuery({
      tableId: orders.id, metrics: [{ column: '*', agg: 'count', as: 'c' }],
      filters: [{ column: 'order_date', op: 'between', value: ['2026-03-01', '2026-04-30'] }],
    }, ctx);
    expect(recent.table.rows[0][0]).toBe(4);
    const big = runQuery({
      tableId: orders.id, metrics: [{ column: '*', agg: 'count', as: 'c' }],
      filters: [{ column: 'revenue', op: 'gte', value: 1800 }],
    }, ctx);
    expect(big.table.rows[0][0]).toBe(4);
  });

  it('groups with time grains and sorts series ascending', async () => {
    const { orders, tables } = await loadFixture();
    const r = runQuery({
      tableId: orders.id, metrics: [{ column: 'revenue', agg: 'sum', as: 'v' }],
      groupBy: ['order_date'], timeGrain: 'month', filters: [],
    }, { tables, relations: [] });
    expect(r.table.rows).toHaveLength(6);
    expect(r.table.rows[0][0]).toBe('2026-01');
    expect(r.table.rows[0][1]).toBe(2000);
    expect(r.totals?.[1]).toBe(18240);
  });

  it('computes share, sort, limit and totals', async () => {
    const { orders, tables } = await loadFixture();
    const r = runQuery({
      tableId: orders.id, metrics: [{ column: 'revenue', agg: 'sum', as: 'v' }],
      groupBy: ['region'], filters: [], withShare: true, limit: 2,
    }, { tables, relations: [] });
    expect(r.table.columns).toContain('% of total');
    expect(r.table.rows).toHaveLength(2);
    expect(r.table.rows[0][0]).toBe('West'); // biggest first by default
    const shareSumAll = runQuery({
      tableId: orders.id, metrics: [{ column: 'revenue', agg: 'sum', as: 'v' }],
      groupBy: ['region'], filters: [], withShare: true,
    }, { tables, relations: [] }).table.rows.reduce((acc, row) => acc + Number(row[2]), 0);
    expect(shareSumAll).toBeCloseTo(100, 0);
  });

  it('builds aging buckets incl. Not due and 90+', async () => {
    const { orders, tables } = await loadFixture();
    const r = runQuery({
      tableId: orders.id,
      metrics: [{ column: 'revenue', agg: 'sum', as: 'v' }],
      filters: [{ column: 'status', op: 'in', value: ['Pending', 'Overdue'] }],
      aging: { dateColumn: 'due_date', buckets: [30, 60, 90], asOf: TODAY },
      withShare: true,
    }, { tables, relations: [] });
    const labels = r.table.rows.map((x) => String(x[0]));
    expect(labels).toContain('Not due');
    expect(labels.some((l) => l.includes('90+'))).toBe(true);
    expect(agingBucketLabels([30, 60, 90])).toEqual(['0–30 days', '31–60 days', '61–90 days', '90+ days']);
  });

  it('truncates dates to grains', () => {
    expect(truncateDate('2026-06-13', 'month')).toBe('2026-06');
    expect(truncateDate('2026-06-13', 'quarter')).toBe('2026-Q2');
    expect(truncateDate('2026-06-13', 'year')).toBe('2026');
    expect(truncateDate('2026-01-01', 'week')).toBe('2026-W01');
  });

  it('throws clear errors for unknown columns', async () => {
    const { orders, tables } = await loadFixture();
    expect(() => runQuery({
      tableId: orders.id, metrics: [{ column: 'nope', agg: 'sum' }], filters: [],
    }, { tables, relations: [] })).toThrow(/not found/);
  });
});

// ── relations / wizard / dashboards / insights ───────────────────────────────

describe('relations + wizard + dashboards + insights', () => {
  it('detects the customer relation', async () => {
    const { tables } = await loadFixture();
    const rels = detectRelations(tables);
    expect(rels.length).toBeGreaterThan(0);
    const r = rels.find((x) => x.fromColumn === 'customer_id' || x.toColumn === 'customer_id');
    expect(r).toBeTruthy();
    expect(r!.matchRate).toBeGreaterThan(0.9);
  });

  it('asks the right questions and decodes answers', async () => {
    const { tables } = await loadFixture();
    const qs = buildWizard(tables, []);
    const ids = qs.map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(['goal', 'dateColumn', 'aging', 'filters', 'kpis']));
    for (const q of qs) expect(q.why.length).toBeGreaterThan(10);
    const intent = buildIntent(tables, {}, qs); // defaults only
    expect(intent.dateColumn).toBeTruthy();
    expect(intent.kpis.length).toBeGreaterThan(0);
    expect(intent.agingBuckets).toEqual([30, 60, 90]);
  });

  it('designs dashboards whose every query runs', async () => {
    const { tables } = await loadFixture();
    const rels = detectRelations(tables);
    const qs = buildWizard(tables, rels);
    const intent = buildIntent(tables, {}, qs);
    const dashes = buildDashboards(tables, rels, intent);
    expect(dashes.length).toBeGreaterThanOrEqual(2); // overview + per-table
    const ctx = { tables, relations: rels, intent };
    let widgets = 0;
    for (const d of dashes) {
      for (const w of d.widgets) {
        widgets++;
        const res = runQuery(w.query, ctx);
        expect(res.table.columns.length).toBeGreaterThan(0);
      }
    }
    expect(widgets).toBeGreaterThanOrEqual(8);
  });

  it('finds real insights (concentration on skewed data)', async () => {
    const { tables } = await loadFixture();
    const rels = detectRelations(tables);
    const intent = buildIntent(tables, {}, buildWizard(tables, rels));
    const ins = generateInsights(tables, rels, intent);
    expect(ins.length).toBeGreaterThan(0);
    expect(ins.some((i) => i.kind === 'concentration')).toBe(true); // West >40%
  });
});

// ── NL analyst ───────────────────────────────────────────────────────────────

describe('NL analyst', () => {
  async function ctx() {
    const { tables } = await loadFixture();
    const rels = detectRelations(tables);
    const intent = buildIntent(tables, {}, buildWizard(tables, rels));
    return { tables, relations: rels, intent, history: [], today: TODAY };
  }

  it('answers totals with the real number', async () => {
    const a = await engine.answer('What is the total revenue?', await ctx());
    expect(a.text).toMatch(/18\.2K|18,240|18240/);
    expect(a.attachments).toHaveLength(1);
  });

  it('breaks down by category', async () => {
    const a = await engine.answer('revenue by region', await ctx());
    expect(a.attachments[0].result.table.rows.map((r) => r[0])).toContain('West');
    expect(a.text).toMatch(/West/);
  });

  it('supports top N', async () => {
    const a = await engine.answer('top 2 categories by revenue', await ctx());
    expect(a.attachments[0].result.table.rows).toHaveLength(2);
  });

  it('does monthly trends', async () => {
    const a = await engine.answer('monthly trend of revenue', await ctx());
    expect(a.attachments[0].widget.type).toBe('line');
    expect(a.attachments[0].result.table.rows.length).toBe(6);
    expect(a.text).toMatch(/up|down/i);
  });

  it('handles share/percentage questions', async () => {
    const a = await engine.answer('share of revenue by category', await ctx());
    expect(a.attachments[0].widget.type).toBe('donut');
    expect(a.attachments[0].result.table.columns).toContain('% of total');
  });

  it('computes aging', async () => {
    const a = await engine.answer('aging of outstanding revenue', await ctx());
    expect(a.attachments[0].widget.type).toBe('aging');
  });

  it('compares X vs Y', async () => {
    const a = await engine.answer('West vs North revenue', await ctx());
    const labels = a.attachments[0].result.table.rows.map((r) => String(r[0]));
    expect(labels).toEqual(expect.arrayContaining(['West', 'North']));
    expect(a.text).toMatch(/West.*North|North.*West/s);
  });

  it('applies value filters from plain words', async () => {
    const a = await engine.answer('total revenue for Electronics', await ctx());
    expect(a.text).toMatch(/8\.1K|8,100|8100/); // 1000+2000+3300+1800
  });

  it('applies date ranges', async () => {
    const a = await engine.answer('how many orders in 2026?', await ctx());
    expect(a.attachments[0].result.table.rows[0][0]).toBe(12);
  });

  it('counts and averages', async () => {
    const c = await engine.answer('how many orders are there', await ctx());
    expect(String(c.text)).toMatch(/12/);
    const avg = await engine.answer('average revenue', await ctx());
    expect(avg.text).toMatch(/1\.5K|1,520|1520/);
  });

  it('forecasts with a clear estimate label', async () => {
    const a = await engine.answer('forecast revenue for next 3 months', await ctx());
    expect(a.text).toMatch(/estimate|trend/i);
    expect(a.attachments[0].result.table.rows.length).toBe(9); // 6 history + 3 est
  });

  it('answers meta questions with schema', async () => {
    const a = await engine.answer('describe my data', await ctx());
    expect(a.text).toMatch(/orders/);
    expect(a.text).toMatch(/revenue/);
  });

  it('falls back gracefully and flags low confidence', async () => {
    const a = await engine.answer('xyzzy plugh quux', await ctx());
    expect(a.lowConfidence).toBe(true);
  });

  it('describeDataForAI ships facts not rows', async () => {
    const c = await ctx();
    const brief = engine.describeDataForAI(c, 'total revenue');
    expect(brief).toMatch(/TABLE/);
    expect(brief).toMatch(/FACT/);
    expect(brief.length).toBeLessThanOrEqual(2500);
    expect(brief).not.toMatch(/O1,2026-01-05/); // no raw rows
  });
});

// ── file ingestion ───────────────────────────────────────────────────────────

describe('file ingestion', () => {
  it('parses JSON arrays', async () => {
    const json = JSON.stringify([{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);
    const out = await parseFiles([new File([json], 'data.json', { type: 'application/json' })]);
    expect(out.tables).toHaveLength(1);
    expect(out.tables[0].columns).toEqual(['a', 'b']);
  });

  it('extracts markdown tables and code blocks from text', async () => {
    const md = `# Report\n\n| city | sales |\n|---|---|\n| Pune | 10 |\n| Goa | 20 |\n\nnotes…`;
    const out = await parseFiles([new File([md], 'notes.md', { type: 'text/markdown' })]);
    expect(out.tables).toHaveLength(1);
    expect(out.tables[0].rowCount).toBe(2);
  });

  it('extracts SQL INSERT data from code', async () => {
    const sql = `create table t (x int);\ninsert into sales (city, amount) values ('Pune', 100), ('Goa', 250);`;
    const out = await parseFiles([new File([sql], 'seed.sql', { type: 'text/plain' })]);
    expect(out.tables).toHaveLength(1);
    expect(out.tables[0].columns).toEqual(['city', 'amount']);
    expect(out.tables[0].rows[1][1]).toBe(250);
  });

  it('keeps unstructured code as AI context with a warning-free pass', async () => {
    const py = 'def hello():\n    return 42\n';
    const out = await parseFiles([new File([py], 'script.py', { type: 'text/plain' })]);
    expect(out.tables).toHaveLength(0);
    expect(out.sources[0].textContent).toMatch(/def hello/);
  });

  it('survives a broken file in a batch', async () => {
    const bad = new File([new Uint8Array([0xff, 0xfe, 0x00])], 'corrupt.xlsx');
    const good = new File(['a,b\n1,2'], 'ok.csv', { type: 'text/csv' });
    const out = await parseFiles([bad, good]);
    expect(out.tables.length).toBeGreaterThanOrEqual(1);
    expect(out.warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ── web ingestion ────────────────────────────────────────────────────────────

describe('web ingestion', () => {
  it('extracts HTML tables from a page', async () => {
    const html = `<html><head><title>Stats Page</title></head><body>
      <table><tr><th>state</th><th>value</th></tr>
      <tr><td>MH</td><td>10</td></tr><tr><td>KA</td><td>20</td></tr></table></body></html>`;
    __setWebFetchForTests((async () => new Response(html, {
      status: 200, headers: { 'content-type': 'text/html' },
    })) as typeof fetch);
    const out = await parseWebUrl('https://example.com/stats');
    expect(out.tables).toHaveLength(1);
    expect(out.tables[0].rowCount).toBe(2);
    expect(out.sources[0].name).toMatch(/Stats Page/);
  });

  it('parses JSON APIs', async () => {
    __setWebFetchForTests((async () => new Response(JSON.stringify([{ id: 1, v: 'a' }]), {
      status: 200, headers: { 'content-type': 'application/json' },
    })) as typeof fetch);
    const out = await parseWebUrl('https://api.example.com/items');
    expect(out.tables).toHaveLength(1);
  });

  it('rejects non-http inputs kindly', async () => {
    const out = await parseWebUrl('ftp://nope');
    expect(out.warnings[0].message).toMatch(/https/);
  });
});
