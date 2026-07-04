import { subDays, startOfDay } from "date-fns";
import {
  parseRange,
  loadRecords,
  loadFilterOptions,
  type DateRange,
} from "@/lib/data";
import {
  filterByDateRange,
  summarize,
  summarizeByDimension,
  worstPincodesByRto,
  dailyTrend,
  type GroupMetric,
  type DailyPoint,
  type MetricRecord,
} from "@/lib/metrics/delivery";

export type SearchParams = { [key: string]: string | string[] | undefined };

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length ? s : undefined;
}

export interface ScopedMetrics {
  range: DateRange;
  zone?: string;
  state?: string;
  options: { zones: string[]; states: string[] };
  hasData: boolean;
  rangeCount: number;
  rangeRecords: MetricRecord[];
  overall: GroupMetric;
  byZone: GroupMetric[];
  byState: GroupMetric[];
  worstPincodes: GroupMetric[];
  trend30: DailyPoint[];
  weekly: { current: GroupMetric; previous: GroupMetric };
}

export async function loadScopedMetrics(
  sp: SearchParams,
  opts?: { defaultDays?: number }
): Promise<ScopedMetrics> {
  const range = parseRange(
    { from: str(sp.from), to: str(sp.to) },
    opts?.defaultDays ?? 30
  );
  const zone = str(sp.zone);
  const state = str(sp.state);

  const [all, options] = await Promise.all([loadRecords(), loadFilterOptions()]);

  let scoped = all;
  if (zone) scoped = scoped.filter((r) => r.zone === zone);
  if (state) scoped = scoped.filter((r) => r.state === state);

  const rangeRecords = filterByDateRange(scoped, range.from, range.to);

  // Weekly summary: last 7 days vs the 7 days before that (independent of the
  // selected range, but respecting any zone/state scope).
  const today = startOfDay(new Date());
  const weekCurrent = filterByDateRange(scoped, subDays(today, 6), today);
  const weekPrevious = filterByDateRange(scoped, subDays(today, 13), subDays(today, 7));

  return {
    range,
    zone,
    state,
    options,
    hasData: all.length > 0,
    rangeCount: rangeRecords.length,
    rangeRecords,
    overall: summarize(rangeRecords),
    byZone: summarizeByDimension(rangeRecords, (r) => r.zone),
    byState: summarizeByDimension(rangeRecords, (r) => r.state),
    worstPincodes: worstPincodesByRto(rangeRecords),
    trend30: dailyTrend(scoped, { days: 30, endDate: range.to }),
    weekly: {
      current: summarize(weekCurrent),
      previous: summarize(weekPrevious),
    },
  };
}
