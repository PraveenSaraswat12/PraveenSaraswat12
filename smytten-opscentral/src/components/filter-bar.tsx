"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { subDays, format } from "date-fns";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export function FilterBar({
  zones = [],
  states = [],
  showZoneState = true,
}: {
  zones?: string[];
  states?: string[];
  showZoneState?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const zone = searchParams.get("zone") ?? "";
  const state = searchParams.get("state") ?? "";

  function update(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyPreset(days: number) {
    const today = new Date();
    update({
      from: format(subDays(today, days - 1), "yyyy-MM-dd"),
      to: format(today, "yyyy-MM-dd"),
    });
  }

  const inputCls =
    "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => update({ from: e.target.value })}
          className={inputCls}
          aria-label="From date"
        />
        <span className="text-muted-foreground">–</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => update({ to: e.target.value })}
          className={inputCls}
          aria-label="To date"
        />
      </div>

      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.days)}
            className={cn(
              "h-9 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-accent"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showZoneState && (
        <>
          <Select
            value={zone}
            onChange={(e) => update({ zone: e.target.value || undefined })}
            className="h-9 w-auto min-w-[9rem]"
            aria-label="Zone filter"
          >
            <option value="">All zones</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
          <Select
            value={state}
            onChange={(e) => update({ state: e.target.value || undefined })}
            className="h-9 w-auto min-w-[9rem]"
            aria-label="State filter"
          >
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </>
      )}

      {(from || to || zone || state) && (
        <button
          onClick={() =>
            update({
              from: undefined,
              to: undefined,
              zone: undefined,
              state: undefined,
            })
          }
          className="h-9 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      )}
    </div>
  );
}
