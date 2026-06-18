import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Rag } from "@/lib/metrics/thresholds";
import { RAG_LABEL } from "@/lib/metrics/thresholds";

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

export function StatCard({
  label,
  value,
  sub,
  rag,
  hint,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  rag?: Rag;
  hint?: string;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "p-5 print-clean",
        rag && "border-l-4",
        rag === "green" && "border-l-success",
        rag === "amber" && "border-l-warning",
        rag === "red" && "border-l-danger",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {rag && (
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span className={cn("h-2 w-2 rounded-full", RAG_DOT[rag])} />
            <span className={RAG_TEXT[rag]}>{RAG_LABEL[rag]}</span>
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
          rag && RAG_TEXT[rag]
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
