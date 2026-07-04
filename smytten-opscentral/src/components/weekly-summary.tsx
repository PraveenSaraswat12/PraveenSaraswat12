import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { GroupMetric } from "@/lib/metrics/delivery";
import { THRESHOLDS, ragFor, RAG_LABEL, type Rag } from "@/lib/metrics/thresholds";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const RAG_DOT: Record<Rag, string> = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-danger",
};
const RAG_TEXT: Record<Rag, string> = {
  green: "text-success",
  amber: "text-warning",
  red: "text-danger",
};

function Delta({
  current,
  previous,
  betterWhenLower,
  hasPrev,
  format,
}: {
  current: number;
  previous: number;
  betterWhenLower: boolean;
  hasPrev: boolean;
  format: (n: number) => string;
}) {
  if (!hasPrev) return <span className="text-xs text-muted-foreground">no prior wk</span>;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> flat
      </span>
    );
  }
  const improved = betterWhenLower ? diff < 0 : diff > 0;
  const Icon = diff > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-xs font-medium",
        improved ? "text-success" : "text-danger"
      )}
    >
      <Icon className="h-3 w-3" />
      {format(Math.abs(diff))} WoW
    </span>
  );
}

export function WeeklySummary({
  current,
  previous,
}: {
  current: GroupMetric;
  previous: GroupMetric;
}) {
  const hasPrev = previous.picked > 0;
  const items = [
    {
      label: THRESHOLDS.p2d.label,
      value: fmtPct(current.p2dPct),
      rag: ragFor(current.p2dPct, THRESHOLDS.p2d),
      cur: current.p2dPct,
      prev: previous.p2dPct,
      betterWhenLower: false,
      fmt: (n: number) => `${n.toFixed(1)}pp`,
    },
    {
      label: THRESHOLDS.rto.label,
      value: fmtPct(current.rtoPct),
      rag: ragFor(current.rtoPct, THRESHOLDS.rto),
      cur: current.rtoPct,
      prev: previous.rtoPct,
      betterWhenLower: true,
      fmt: (n: number) => `${n.toFixed(1)}pp`,
    },
    {
      label: THRESHOLDS.ndr.label,
      value: current.avgNdr.toFixed(2),
      rag: ragFor(current.avgNdr, THRESHOLDS.ndr),
      cur: current.avgNdr,
      prev: previous.avgNdr,
      betterWhenLower: true,
      fmt: (n: number) => n.toFixed(2),
    },
    {
      label: THRESHOLDS.tat.label,
      value: fmtPct(current.tatBreachPct),
      rag: ragFor(current.tatBreachPct, THRESHOLDS.tat),
      cur: current.tatBreachPct,
      prev: previous.tatBreachPct,
      betterWhenLower: true,
      fmt: (n: number) => `${n.toFixed(1)}pp`,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Weekly summary</CardTitle>
        <CardDescription>
          Auto-calculated · last 7 days vs previous 7 days
          {` · ${current.picked.toLocaleString("en-IN")} shipments`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.label}>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", RAG_DOT[it.rag])} />
                {it.label}
              </div>
              <div className={cn("mt-1 text-2xl font-semibold tabular-nums", RAG_TEXT[it.rag])}>
                {it.value}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className={cn("text-xs", RAG_TEXT[it.rag])}>
                  {RAG_LABEL[it.rag]}
                </span>
                <Delta
                  current={it.cur}
                  previous={it.prev}
                  betterWhenLower={it.betterWhenLower}
                  hasPrev={hasPrev}
                  format={it.fmt}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
