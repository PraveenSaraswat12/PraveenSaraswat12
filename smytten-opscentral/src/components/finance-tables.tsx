"use client";

import { DataTable, type Column } from "@/components/data-table";
import type { CodGroup } from "@/lib/metrics/finance";
import { fmtNum, fmtInr } from "@/lib/format";

export function CodTable({
  rows,
  dimensionLabel,
}: {
  rows: CodGroup[];
  dimensionLabel: string;
}) {
  const columns: Column<CodGroup>[] = [
    {
      key: "key",
      header: dimensionLabel,
      sortable: true,
      value: (r) => r.key,
      render: (r) => <span className="font-medium">{r.key}</span>,
    },
    {
      key: "count",
      header: "COD shipments",
      align: "right",
      sortable: true,
      value: (r) => r.count,
      render: (r) => fmtNum(r.count),
    },
    {
      key: "total",
      header: "Total COD",
      align: "right",
      sortable: true,
      value: (r) => r.total,
      render: (r) => fmtInr(r.total),
    },
    {
      key: "delivered",
      header: "Collected",
      align: "right",
      sortable: true,
      value: (r) => r.delivered,
      render: (r) => fmtInr(r.delivered),
    },
    {
      key: "rto",
      header: "In RTO",
      align: "right",
      sortable: true,
      value: (r) => r.rto,
      render: (r) => (
        <span className={r.rto > 0 ? "font-medium text-danger" : ""}>
          {fmtInr(r.rto)}
        </span>
      ),
    },
    {
      key: "inFlight",
      header: "In-flight",
      align: "right",
      sortable: true,
      value: (r) => r.inFlight,
      render: (r) => fmtInr(r.inFlight),
    },
  ];
  return <DataTable columns={columns} rows={rows} initialSortKey="total" />;
}
