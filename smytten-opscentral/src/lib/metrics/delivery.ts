import { format, subDays, startOfDay } from "date-fns";
import { DeliveryStatus } from "@/generated/prisma/enums";

// Minimal record shape the metric functions need. DeliveryRecord rows satisfy
// this, so dashboard queries can pass Prisma results straight in.
export interface MetricRecord {
  status: DeliveryStatus;
  isRTO: boolean;
  ndrAttempts: number;
  pincode: string | null;
  state: string | null;
  zone: string | null;
  weight: number | null;
  codAmount: number | null;
  orderDate: Date | null;
  pickupDate: Date | null;
  deliveryDate: Date | null;
}

export const DEFAULT_SLA_DAYS = 5;

// Statuses that imply a shipment left the pickup point.
const POST_PICKUP: DeliveryStatus[] = [
  DeliveryStatus.DELIVERED,
  DeliveryStatus.RTO,
  DeliveryStatus.IN_TRANSIT,
  DeliveryStatus.OUT_FOR_DELIVERY,
  DeliveryStatus.NDR,
  DeliveryStatus.LOST,
];

/** Best-available date used for range filtering and daily bucketing. */
export function referenceDate(r: MetricRecord): Date | null {
  return r.pickupDate ?? r.orderDate ?? r.deliveryDate ?? null;
}

export function isPicked(r: MetricRecord): boolean {
  return r.pickupDate != null || POST_PICKUP.includes(r.status);
}

/** Turnaround in days from pickup (or order) to delivery, for delivered rows. */
export function tatDays(r: MetricRecord): number | null {
  if (r.status !== DeliveryStatus.DELIVERED || !r.deliveryDate) return null;
  const start = r.pickupDate ?? r.orderDate;
  if (!start) return null;
  const diff =
    (startOfDay(r.deliveryDate).getTime() - startOfDay(start).getTime()) /
    86_400_000;
  return diff < 0 ? 0 : Math.round(diff * 10) / 10;
}

export interface GroupMetric {
  key: string;
  total: number;
  picked: number;
  delivered: number;
  rtoCount: number;
  ndrCount: number; // shipments with >= 1 attempt
  p2dPct: number;
  rtoPct: number;
  avgNdr: number;
  ndrIncidencePct: number;
  tatBreachPct: number;
  avgTatDays: number | null;
  codExposure: number; // COD value not yet delivered (in-flight + RTO + NDR)
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (num: number, den: number) => (den > 0 ? round1((num / den) * 100) : 0);

export function summarize(
  records: MetricRecord[],
  key = "Overall",
  slaDays = DEFAULT_SLA_DAYS
): GroupMetric {
  let picked = 0;
  let delivered = 0;
  let rtoCount = 0;
  let ndrCount = 0;
  let ndrAttemptSum = 0;
  let tatCount = 0;
  let tatBreaches = 0;
  let tatSum = 0;
  let codExposure = 0;

  for (const r of records) {
    const pickedFlag = isPicked(r);
    if (pickedFlag) picked++;
    if (r.status === DeliveryStatus.DELIVERED) delivered++;
    if (r.isRTO) rtoCount++;
    if (r.ndrAttempts >= 1) ndrCount++;
    if (pickedFlag) ndrAttemptSum += r.ndrAttempts;

    if (r.status !== DeliveryStatus.DELIVERED && r.codAmount) {
      codExposure += r.codAmount;
    }

    const t = tatDays(r);
    if (t != null) {
      tatCount++;
      tatSum += t;
      if (t > slaDays) tatBreaches++;
    }
  }

  return {
    key,
    total: records.length,
    picked,
    delivered,
    rtoCount,
    ndrCount,
    p2dPct: pct(delivered, picked),
    rtoPct: pct(rtoCount, picked),
    avgNdr: picked > 0 ? round1(ndrAttemptSum / picked) : 0,
    ndrIncidencePct: pct(ndrCount, picked),
    tatBreachPct: pct(tatBreaches, tatCount),
    avgTatDays: tatCount > 0 ? round1(tatSum / tatCount) : null,
    codExposure: Math.round(codExposure),
  };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    if (!k) continue;
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export function summarizeByDimension(
  records: MetricRecord[],
  keyFn: (r: MetricRecord) => string | null,
  slaDays = DEFAULT_SLA_DAYS
): GroupMetric[] {
  const groups = groupBy(records, keyFn);
  return Array.from(groups.entries())
    .map(([key, rows]) => summarize(rows, key, slaDays))
    .sort((a, b) => b.total - a.total);
}

/** Worst-performing pincodes by RTO%, filtered by a minimum volume. */
export function worstPincodesByRto(
  records: MetricRecord[],
  { minShipments = 5, limit = 10, slaDays = DEFAULT_SLA_DAYS } = {}
): GroupMetric[] {
  return summarizeByDimension(records, (r) => r.pincode, slaDays)
    .filter((g) => g.picked >= minShipments)
    .sort((a, b) => b.rtoPct - a.rtoPct || b.picked - a.picked)
    .slice(0, limit);
}

export interface DailyPoint {
  date: string; // yyyy-MM-dd
  label: string; // dd MMM
  picked: number;
  delivered: number;
  rtoCount: number;
  p2dPct: number;
  rtoPct: number;
}

/** Daily P-to-D% and RTO% over the last `days`, bucketed by reference date. */
export function dailyTrend(
  records: MetricRecord[],
  { days = 30, endDate = new Date(), slaDays = DEFAULT_SLA_DAYS } = {}
): DailyPoint[] {
  const buckets = new Map<string, MetricRecord[]>();
  for (const r of records) {
    const d = referenceDate(r);
    if (!d) continue;
    const key = format(d, "yyyy-MM-dd");
    const arr = buckets.get(key);
    if (arr) arr.push(r);
    else buckets.set(key, [r]);
  }

  const points: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(startOfDay(endDate), i);
    const key = format(d, "yyyy-MM-dd");
    const rows = buckets.get(key) ?? [];
    const m = summarize(rows, key, slaDays);
    points.push({
      date: key,
      label: format(d, "dd MMM"),
      picked: m.picked,
      delivered: m.delivered,
      rtoCount: m.rtoCount,
      p2dPct: m.p2dPct,
      rtoPct: m.rtoPct,
    });
  }
  return points;
}

export interface DashboardMetrics {
  overall: GroupMetric;
  byZone: GroupMetric[];
  byState: GroupMetric[];
  worstPincodes: GroupMetric[];
  trend30: DailyPoint[];
}

export function computeDashboard(
  records: MetricRecord[],
  { slaDays = DEFAULT_SLA_DAYS, endDate = new Date() } = {}
): DashboardMetrics {
  return {
    overall: summarize(records, "Overall", slaDays),
    byZone: summarizeByDimension(records, (r) => r.zone, slaDays),
    byState: summarizeByDimension(records, (r) => r.state, slaDays),
    worstPincodes: worstPincodesByRto(records, { slaDays }),
    trend30: dailyTrend(records, { days: 30, endDate, slaDays }),
  };
}

/** Filter records whose reference date falls within [from, to] (inclusive). */
export function filterByDateRange(
  records: MetricRecord[],
  from: Date | null,
  to: Date | null
): MetricRecord[] {
  if (!from && !to) return records;
  const fromT = from ? startOfDay(from).getTime() : -Infinity;
  const toT = to ? startOfDay(to).getTime() + 86_400_000 - 1 : Infinity;
  return records.filter((r) => {
    const d = referenceDate(r);
    if (!d) return false;
    const t = d.getTime();
    return t >= fromT && t <= toT;
  });
}
