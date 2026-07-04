"use client";

import { DataTable, type Column } from "@/components/data-table";
import type { GroupMetric } from "@/lib/metrics/delivery";
import { fmtPct, fmtNum, fmtDays } from "@/lib/format";
import { cn } from "@/lib/utils";

function RtoCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        value > 12 ? "font-semibold text-danger" : value > 8 ? "text-warning" : ""
      )}
    >
      {fmtPct(value)}
    </span>
  );
}

function P2dCell({ value }: { value: number }) {
  return (
    <span
      className={cn("tabular-nums", value < 85 ? "text-warning" : "text-success")}
    >
      {fmtPct(value)}
    </span>
  );
}

export function ZoneTable({ rows }: { rows: GroupMetric[] }) {
  const columns: Column<GroupMetric>[] = [
    { key: "key", header: "Zone", sortable: true, value: (r) => r.key, render: (r) => <span className="font-medium">{r.key}</span> },
    { key: "picked", header: "Shipments", align: "right", sortable: true, value: (r) => r.picked, render: (r) => fmtNum(r.picked) },
    { key: "p2d", header: "P-to-D", align: "right", sortable: true, value: (r) => r.p2dPct, render: (r) => <P2dCell value={r.p2dPct} /> },
    { key: "rto", header: "RTO", align: "right", sortable: true, value: (r) => r.rtoPct, render: (r) => <RtoCell value={r.rtoPct} /> },
    { key: "ndr", header: "Avg NDR", align: "right", sortable: true, value: (r) => r.avgNdr, render: (r) => r.avgNdr.toFixed(2) },
    { key: "tat", header: "TAT breach", align: "right", sortable: true, value: (r) => r.tatBreachPct, render: (r) => fmtPct(r.tatBreachPct) },
    { key: "avgtat", header: "Avg TAT", align: "right", sortable: true, value: (r) => r.avgTatDays ?? -1, render: (r) => fmtDays(r.avgTatDays) },
  ];
  return <DataTable columns={columns} rows={rows} initialSortKey="picked" />;
}

export function WorstPincodeTable({ rows }: { rows: GroupMetric[] }) {
  const columns: Column<GroupMetric>[] = [
    { key: "key", header: "Pincode", sortable: true, value: (r) => r.key, render: (r) => <span className="font-mono font-medium">{r.key}</span> },
    { key: "picked", header: "Shipments", align: "right", sortable: true, value: (r) => r.picked, render: (r) => fmtNum(r.picked) },
    { key: "rto", header: "RTO", align: "right", sortable: true, value: (r) => r.rtoPct, render: (r) => <RtoCell value={r.rtoPct} /> },
    { key: "p2d", header: "P-to-D", align: "right", sortable: true, value: (r) => r.p2dPct, render: (r) => fmtPct(r.p2dPct) },
    { key: "avgtat", header: "Avg TAT", align: "right", sortable: true, value: (r) => r.avgTatDays ?? -1, render: (r) => fmtDays(r.avgTatDays) },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      initialSortKey="rto"
      emptyText="No pincodes with enough volume in range."
    />
  );
}

export function StateTable({ rows }: { rows: GroupMetric[] }) {
  const columns: Column<GroupMetric>[] = [
    { key: "key", header: "State", sortable: true, value: (r) => r.key, render: (r) => <span className="font-medium">{r.key}</span> },
    { key: "picked", header: "Shipments", align: "right", sortable: true, value: (r) => r.picked, render: (r) => fmtNum(r.picked) },
    { key: "p2d", header: "P-to-D", align: "right", sortable: true, value: (r) => r.p2dPct, render: (r) => fmtPct(r.p2dPct) },
    { key: "rto", header: "RTO", align: "right", sortable: true, value: (r) => r.rtoPct, render: (r) => <RtoCell value={r.rtoPct} /> },
  ];
  return <DataTable columns={columns} rows={rows} initialSortKey="rto" />;
}
