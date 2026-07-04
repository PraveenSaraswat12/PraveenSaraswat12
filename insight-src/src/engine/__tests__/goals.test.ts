// QA: conversational goals → intent → proposal (the no-schema-questions flow).
import { describe, expect, it } from 'vitest';
import { parseFiles } from '../io/files';
import { detectRelations } from '../relations';
import { applyProposal, buildIntentFromGoals, proposeDashboards, suggestGoalChips } from '../goals';
import { runQuery } from '../query';

const ORDERS = [
  'order_id,order_date,customer_id,region,category,units,revenue,status,due_date',
  'O1,2026-01-05,C01,West,Electronics,10,1000,Paid,2026-02-05',
  'O2,2026-02-15,C02,West,Apparel,5,1000,Paid,2026-03-15',
  'O3,2026-03-03,C01,North,Electronics,20,2000,Pending,2026-04-03',
  'O4,2026-04-20,C03,South,Home,4,1000,Overdue,2026-03-20',
  'O5,2026-05-10,C02,East,Apparel,8,1200,Paid,2026-06-10',
  'O6,2026-06-01,C04,West,Beauty,3,1500,Overdue,2026-04-22',
].join('\n');

async function fixture() {
  const out = await parseFiles([new File([ORDERS], 'orders.csv', { type: 'text/csv' })]);
  const tables = out.tables;
  const relations = detectRelations(tables);
  return { tables, relations };
}

describe('goal chips', () => {
  it('suggests human phrases from the actual data, never schema words', async () => {
    const { tables, relations } = await fixture();
    const chips = suggestGoalChips(tables, relations);
    expect(chips.learn.length).toBeGreaterThan(0);
    expect(chips.decide.length).toBeGreaterThan(0);
    expect(chips.custom.length).toBeGreaterThan(0);
    const all = [...chips.learn, ...chips.decide, ...chips.custom].join(' ');
    expect(all).toMatch(/Sales|revenue|overdue|Region/i); // grounded in this data
    expect(all).not.toMatch(/tableId|::|column_/);
  });
});

describe('buildIntentFromGoals', () => {
  it('maps overdue-payment language to aging on the due date', async () => {
    const { tables, relations } = await fixture();
    const intent = buildIntentFromGoals(tables, relations, {
      learn: 'Receivables & payment aging',
      decide: 'Follow up overdue payments',
    });
    expect(intent.agingBuckets).toEqual([30, 60, 90]);
    expect(intent.dateColumn?.column).toBe('due_date'); // due-style date preferred
    expect(intent.kpis.length).toBeGreaterThan(0);
    expect(intent.filterColumns.length).toBeGreaterThanOrEqual(2); // multiple filters
  });

  it('respects custom buckets typed in plain text', async () => {
    const { tables, relations } = await fixture();
    const intent = buildIntentFromGoals(tables, relations, {
      custom: 'track pending items in 15/45/75 day buckets',
    });
    expect(intent.agingBuckets).toEqual([15, 45, 75]);
  });

  it('picks a mentioned dimension as compare-by', async () => {
    const { tables, relations } = await fixture();
    const intent = buildIntentFromGoals(tables, relations, {
      learn: 'which region performs best on revenue',
    });
    expect(intent.compareBy?.column).toBe('region');
    expect(intent.kpis[0].ref.column).toBe('revenue');
  });

  it('works with completely empty answers (decide-for-me)', async () => {
    const { tables, relations } = await fixture();
    const intent = buildIntentFromGoals(tables, relations, {});
    expect(intent.goal.length).toBeGreaterThan(3);
    expect(intent.kpis.length).toBeGreaterThan(0);
    expect(intent.dateColumn).toBeTruthy();
    expect(intent.filterColumns.length).toBeGreaterThan(0);
  });
});

describe('proposeDashboards + applyProposal', () => {
  it('produces reasoned items whose widgets all run, and honors unticks', async () => {
    const { tables, relations } = await fixture();
    const intent = buildIntentFromGoals(tables, relations, { learn: 'sales performance' });
    const proposal = proposeDashboards(tables, relations, intent);

    expect(proposal.items.length).toBeGreaterThanOrEqual(5);
    for (const item of proposal.items) {
      expect(item.reason.length).toBeGreaterThan(10);
      expect(['widget', 'filter']).toContain(item.kind);
    }
    expect(proposal.items.filter((i) => i.kind === 'filter').length).toBeGreaterThanOrEqual(2);

    // every proposed widget query executes
    const ctx = { tables, relations, intent };
    for (const item of proposal.items) {
      if (item.widget) expect(() => runQuery(item.widget!.query, ctx)).not.toThrow();
    }

    // untick a widget and a filter → both gone after apply
    const w = proposal.items.find((i) => i.kind === 'widget')!;
    const f = proposal.items.find((i) => i.kind === 'filter')!;
    const enabled = new Set(proposal.items.map((i) => i.id));
    enabled.delete(w.id);
    enabled.delete(f.id);
    const dashboards = applyProposal(proposal, enabled);
    expect(dashboards.length).toBeGreaterThan(0);
    expect(dashboards.flatMap((d) => d.widgets).some((x) => x.id === w.id)).toBe(false);
    const fRef = f.filterRef!;
    const stillThere = dashboards.some(
      (d) => `f:${d.id}:${fRef.tableId}:${fRef.column}` === f.id &&
        d.globalFilterColumns.some((g) => g.tableId === fRef.tableId && g.column === fRef.column),
    );
    expect(stillThere).toBe(false);
  });
});
