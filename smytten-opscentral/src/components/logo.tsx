import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Boxes className="h-5 w-5" />
      </div>
      {!compact && (
        <div className="text-[15px] font-semibold leading-none tracking-tight">
          Smytten <span className="text-primary">OpsCentral</span>
        </div>
      )}
    </div>
  );
}
