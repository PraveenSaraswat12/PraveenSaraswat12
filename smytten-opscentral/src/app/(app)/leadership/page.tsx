import { format } from "date-fns";
import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { StatCard } from "@/components/stat-card";
import { ChartCard } from "@/components/section-card";
import { EmptyState } from "@/components/empty-state";
import { TrendChart } from "@/components/charts/trend-chart";
import { ZoneTable, WorstPincodeTable } from "@/components/metric-tables";
import { WeeklySummary } from "@/components/weekly-summary";
import { loadScopedMetrics, type SearchParams } from "@/lib/metrics/page-data";
import { THRESHOLDS, ragFor } from "@/lib/metrics/thresholds";
import { fmtPct, fmtNum, fmtDays } from "@/lib/format";

export const dynamic = "force-dynamic";

const PURPLE = "#6C3FD1";
const RED = "#dc2626";

export default async function LeadershipPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["OPS_LEAD"]);
  const m = await loadScopedMetrics(searchParams);
  const o = m.overall;
  const rangeLabel = `${format(m.range.from, "d MMM")} – ${format(
    m.range.to,
    "d MMM yyyy"
  )}`;

  return (
    <>
      <PageHeader
        title="Leadership"
        description={`RAG status against targets · ${rangeLabel}`}
      >
        <FilterBar zones={m.options.zones} states={m.options.states} />
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-6">
        {!m.hasData ? (
          <EmptyState
            title="No delivery data yet"
            description="Upload a Delhivery MIS export to see leadership metrics."
            actionHref="/uploads"
            actionLabel="Upload CSV"
          />
        ) : (
          <>
            <WeeklySummary current={m.weekly.current} previous={m.weekly.previous} />

            {/* RAG KPI row for the selected range */}
            <div>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Selected range · {fmtNum(o.picked)} shipments
              </h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label={THRESHOLDS.p2d.label}
                  value={fmtPct(o.p2dPct)}
                  sub="Target ≥ 85%"
                  rag={ragFor(o.p2dPct, THRESHOLDS.p2d)}
                />
                <StatCard
                  label={THRESHOLDS.rto.label}
                  value={fmtPct(o.rtoPct)}
                  sub="Target ≤ 12%"
                  rag={ragFor(o.rtoPct, THRESHOLDS.rto)}
                />
                <StatCard
                  label={THRESHOLDS.ndr.label}
                  value={o.avgNdr.toFixed(2)}
                  sub="Target ≤ 1.5"
                  rag={ragFor(o.avgNdr, THRESHOLDS.ndr)}
                />
                <StatCard
                  label={THRESHOLDS.tat.label}
                  value={fmtPct(o.tatBreachPct)}
                  sub={`Avg TAT ${fmtDays(o.avgTatDays)} · 5-day SLA`}
                  rag={ragFor(o.tatBreachPct, THRESHOLDS.tat)}
                />
              </div>
            </div>

            {/* Trends */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Daily P-to-D %" description="Last 30 days">
                <TrendChart
                  data={m.trend30}
                  dataKey="p2dPct"
                  color={PURPLE}
                  target={85}
                  targetLabel="Target 85%"
                />
              </ChartCard>
              <ChartCard title="Daily RTO %" description="Last 30 days">
                <TrendChart
                  data={m.trend30}
                  dataKey="rtoPct"
                  color={RED}
                  target={12}
                  targetLabel="Threshold 12%"
                />
              </ChartCard>
            </div>

            <ChartCard
              title="Performance by zone"
              bodyClassName="px-0 pb-0"
            >
              <ZoneTable rows={m.byZone} />
            </ChartCard>

            <ChartCard
              title="Top 10 worst pincodes by RTO%"
              description="Min. 5 shipments in range"
              bodyClassName="px-0 pb-0"
            >
              <WorstPincodeTable rows={m.worstPincodes} />
            </ChartCard>
          </>
        )}
      </div>
    </>
  );
}
