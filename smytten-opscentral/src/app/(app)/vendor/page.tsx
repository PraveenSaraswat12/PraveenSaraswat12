import { format } from "date-fns";
import { Boxes } from "lucide-react";
import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { PrintButton } from "@/components/print-button";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { loadScopedMetrics, type SearchParams } from "@/lib/metrics/page-data";
import { fmtPct, fmtNum, fmtDays } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VendorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["VENDOR", "OPS_LEAD"]);
  const m = await loadScopedMetrics(searchParams);
  const o = m.overall;
  const rangeLabel = `${format(m.range.from, "d MMM yyyy")} – ${format(
    m.range.to,
    "d MMM yyyy"
  )}`;

  return (
    <>
      <PageHeader
        title="Vendor SLA Report"
        description="Delhivery service-level summary"
      >
        <div className="no-print flex items-center gap-2">
          <FilterBar showZoneState={false} />
          <PrintButton />
        </div>
      </PageHeader>

      <div className="p-4 sm:p-6">
        {!m.hasData ? (
          <EmptyState
            title="No delivery data yet"
            description="Once Delhivery MIS data is imported, the SLA report will appear here."
          />
        ) : (
          <Card className="mx-auto max-w-4xl p-8 print-clean">
            {/* Report header */}
            <div className="flex items-start justify-between border-b pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Boxes className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Smytten OpsCentral</div>
                    <div className="text-xs text-muted-foreground">
                      Courier: Delhivery
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div className="text-sm font-medium text-foreground">
                  SLA Report
                </div>
                <div>{rangeLabel}</div>
                <div>Generated {format(new Date(), "d MMM yyyy")}</div>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 py-6">
              <ReportStat
                label="Picked → Delivered"
                value={fmtPct(o.p2dPct)}
                sub={`${fmtNum(o.delivered)} of ${fmtNum(o.picked)}`}
              />
              <ReportStat label="RTO" value={fmtPct(o.rtoPct)} sub={`${fmtNum(o.rtoCount)} returns`} />
              <ReportStat
                label="Avg TAT"
                value={fmtDays(o.avgTatDays)}
                sub={`${fmtPct(o.tatBreachPct)} over 5-day SLA`}
              />
            </div>

            {/* By zone */}
            <div className="pt-2">
              <h3 className="mb-2 text-sm font-semibold">By zone</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead className="text-right">Shipments</TableHead>
                    <TableHead className="text-right">P-to-D</TableHead>
                    <TableHead className="text-right">RTO</TableHead>
                    <TableHead className="text-right">Avg TAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.byZone.map((z) => (
                    <TableRow key={z.key}>
                      <TableCell className="font-medium">{z.key}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNum(z.picked)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtPct(z.p2dPct)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtPct(z.rtoPct)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtDays(z.avgTatDays)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
              This report is generated from Delhivery MIS data imported into
              Smytten OpsCentral. P-to-D = delivered ÷ picked. TAT measured from
              pickup to delivery against a 5-day SLA.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}

function ReportStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
