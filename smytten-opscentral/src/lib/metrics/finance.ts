import { DeliveryStatus } from "@/generated/prisma/enums";
import type { MetricRecord } from "./delivery";

export interface CodSummary {
  count: number; // COD shipments (codAmount > 0)
  total: number; // total COD value
  delivered: number; // COD collected on delivered shipments
  rto: number; // COD locked in RTO (returned, not collected)
  inFlight: number; // COD not yet delivered and not RTO
}

export function codSummary(records: MetricRecord[]): CodSummary {
  let count = 0;
  let total = 0;
  let delivered = 0;
  let rto = 0;
  let inFlight = 0;

  for (const r of records) {
    const cod = r.codAmount ?? 0;
    if (cod <= 0) continue;
    count++;
    total += cod;
    if (r.status === DeliveryStatus.DELIVERED) delivered += cod;
    else if (r.isRTO) rto += cod;
    else inFlight += cod;
  }

  return {
    count,
    total: Math.round(total),
    delivered: Math.round(delivered),
    rto: Math.round(rto),
    inFlight: Math.round(inFlight),
  };
}

export interface CodGroup extends CodSummary {
  key: string;
}

export function codByDimension(
  records: MetricRecord[],
  keyFn: (r: MetricRecord) => string | null
): CodGroup[] {
  const groups = new Map<string, MetricRecord[]>();
  for (const r of records) {
    const k = keyFn(r);
    if (!k) continue;
    const arr = groups.get(k);
    if (arr) arr.push(r);
    else groups.set(k, [r]);
  }
  return Array.from(groups.entries())
    .map(([key, rows]) => ({ key, ...codSummary(rows) }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.total - a.total);
}
