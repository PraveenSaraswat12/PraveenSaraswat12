"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { DailyPoint } from "@/lib/metrics/delivery";

interface TrendChartProps {
  data: DailyPoint[];
  dataKey: "p2dPct" | "rtoPct";
  color: string;
  target?: number;
  targetLabel?: string;
  height?: number;
}

function TrendTooltip({
  active,
  payload,
  dataKey,
}: {
  active?: boolean;
  payload?: Array<{ payload: DailyPoint }>;
  dataKey: "p2dPct" | "rtoPct";
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium">{p.label}</div>
      <div className="mt-1 tabular-nums">
        {dataKey === "p2dPct" ? "P-to-D" : "RTO"}:{" "}
        <span className="font-semibold">{p[dataKey].toFixed(1)}%</span>
      </div>
      <div className="text-muted-foreground tabular-nums">
        {p.delivered}/{p.picked} delivered · {p.rtoCount} RTO
      </div>
    </div>
  );
}

export function TrendChart({
  data,
  dataKey,
  color,
  target,
  targetLabel,
  height = 240,
}: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={28}
          stroke="#9ca3af"
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          width={44}
          stroke="#9ca3af"
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          content={<TrendTooltip dataKey={dataKey} />}
          cursor={{ stroke: "#d1d5db", strokeWidth: 1 }}
        />
        {target != null && (
          <ReferenceLine
            y={target}
            stroke="#9ca3af"
            strokeDasharray="5 4"
            label={{
              value: targetLabel ?? `Target ${target}%`,
              position: "insideTopRight",
              fontSize: 10,
              fill: "#6b7280",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
