import { format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { StatCard } from "@/components/stat-card";
import { ChartCard } from "@/components/section-card";
import { EmptyState } from "@/components/empty-state";
import { TrendChart } from "@/components/charts/trend-chart";
import { ZoneTable, WorstPincodeTable, StateTable } from "@/components/metric-tables";
import { loadScopedMetrics, type SearchParams } from "@/lib/metrics/page-data";
import { fmtPct, fmtNum, fmtDays } from "@/lib/format";

export const dynamic = "force-dynamic";

const PURPLE = "#6C3FD1";
const RED = "#dc2626";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const m = await loadScopedMetrics(searchParams);
  const o = m.overall;
  const rangeLabel = `${format(m.range.from, "d MMM")} – ${format(
    m.range.to,
    "d MMM yyyy"
  )}`;

  return (
    <>
      <PageHeader
        title="Courier Intelligence"
        description={`Delhivery last-mile performance · ${rangeLabel}`}
      >
        <FilterBar zones={m.options.zones} states={m.options.states} />
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-6">
        {!m.hasData ? (
          <EmptyState
            title="No delivery data yet"
            description="Upload a Delhivery MIS export to populate the courier intelligence dashboard."
            actionHref="/uploads"
            actionLabel="Upload CSV"
          />
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatCard
                label="Shipments picked"
                value={fmtNum(o.picked)}
                sub={`${fmtNum(o.delivered)} delivered · ${fmtNum(o.total)} total`}
              />
              <StatCard
                label="P-to-D"
                value={fmtPct(o.p2dPct)}
                hint="Target ≥ 85%"
              />
              <StatCard label="RTO" value={fmtPct(o.rtoPct)} hint="Target ≤ 12%" />
              <StatCard
                label="Avg NDR attempts"
                value={o.avgNdr.toFixed(2)}
                sub={`${fmtPct(o.ndrIncidencePct)} needed ≥1 attempt`}
                hint="Target ≤ 1.5"
              />
              <StatCard
                label="TAT breach"
                value={fmtPct(o.tatBreachPct)}
                sub={`Avg TAT ${fmtDays(o.avgTatDays)}`}
                hint="5-day SLA"
              />
            </div>

            {/* Trend charts */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Daily P-to-D %"
                description="Picked → delivered, last 30 days"
              >
                <TrendChart
                  data={m.trend30}
                  dataKey="p2dPct"
                  color={PURPLE}
                  target={85}
                  targetLabel="Target 85%"
                />
              </ChartCard>
              <ChartCard
                title="Daily RTO %"
                description="Return to origin, last 30 days"
              >
                <TrendChart
                  data={m.trend30}
                  dataKey="rtoPct"
                  color={RED}
                  target={12}
                  targetLabel="Threshold 12%"
                />
              </ChartCard>
            </div>

            {/* Zone breakdown */}
            <ChartCard
              title="Performance by zone"
              description="Sort any column · click headers"
              bodyClassName="px-0 pb-0"
            >
              <ZoneTable rows={m.byZone} />
            </ChartCard>

            {/* Worst pincodes + state */}
            <div className="grid gap-4 xl:grid-cols-2">
              <ChartCard
                title="Top 10 worst pincodes by RTO%"
                description="Min. 5 shipments in range"
                bodyClassName="px-0 pb-0"
              >
                <WorstPincodeTable rows={m.worstPincodes} />
              </ChartCard>
              <ChartCard
                title="RTO by state"
                description="Highest-volume destination states"
                bodyClassName="px-0 pb-0"
              >
                <StateTable rows={m.byState.slice(0, 12)} />
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </>
  );
}
