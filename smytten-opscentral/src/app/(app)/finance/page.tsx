import { format } from "date-fns";
import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { StatCard } from "@/components/stat-card";
import { ChartCard } from "@/components/section-card";
import { EmptyState } from "@/components/empty-state";
import { CodTable } from "@/components/finance-tables";
import { loadScopedMetrics, type SearchParams } from "@/lib/metrics/page-data";
import { codSummary, codByDimension } from "@/lib/metrics/finance";
import { fmtInr, fmtNum, fmtPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["FINANCE", "OPS_LEAD"]);
  const m = await loadScopedMetrics(searchParams);
  const cod = codSummary(m.rangeRecords);
  const byState = codByDimension(m.rangeRecords, (r) => r.state);
  const byZone = codByDimension(m.rangeRecords, (r) => r.zone);
  const rangeLabel = `${format(m.range.from, "d MMM")} – ${format(
    m.range.to,
    "d MMM yyyy"
  )}`;

  const collectedPct = cod.total > 0 ? (cod.delivered / cod.total) * 100 : 0;
  const atRiskPct = cod.total > 0 ? (cod.rto / cod.total) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Finance · COD"
        description={`Cash-on-delivery exposure & collection · ${rangeLabel}`}
      >
        <FilterBar zones={m.options.zones} states={m.options.states} />
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-6">
        {!m.hasData ? (
          <EmptyState
            title="No delivery data yet"
            description="Upload Delhivery MIS data to see COD exposure and collection."
            actionHref="/uploads"
            actionLabel="Upload CSV"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Total COD"
                value={fmtInr(cod.total)}
                sub={`${fmtNum(cod.count)} COD shipments`}
              />
              <StatCard
                label="Collected"
                value={fmtInr(cod.delivered)}
                sub={`${fmtPct(collectedPct)} of COD value`}
              />
              <StatCard
                label="Locked in RTO"
                value={fmtInr(cod.rto)}
                sub={`${fmtPct(atRiskPct)} value at risk`}
                rag={atRiskPct > 12 ? "red" : atRiskPct > 8 ? "amber" : "green"}
              />
              <StatCard
                label="In-flight exposure"
                value={fmtInr(cod.inFlight)}
                sub="Not yet delivered"
              />
            </div>

            <ChartCard
              title="COD by state"
              description="Highest COD value first · sortable"
              bodyClassName="px-0 pb-0"
            >
              <CodTable rows={byState} dimensionLabel="State" />
            </ChartCard>

            <ChartCard
              title="COD by zone"
              bodyClassName="px-0 pb-0"
            >
              <CodTable rows={byZone} dimensionLabel="Zone" />
            </ChartCard>
          </>
        )}
      </div>
    </>
  );
}
