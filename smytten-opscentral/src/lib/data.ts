import { subDays, startOfDay, parseISO, isValid, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { MetricRecord } from "@/lib/metrics/delivery";

export interface DateRange {
  from: Date;
  to: Date;
  fromStr: string;
  toStr: string;
}

export function parseRange(
  sp: { from?: string; to?: string },
  defaultDays = 30
): DateRange {
  const to =
    sp.to && isValid(parseISO(sp.to)) ? startOfDay(parseISO(sp.to)) : startOfDay(new Date());
  const from =
    sp.from && isValid(parseISO(sp.from))
      ? startOfDay(parseISO(sp.from))
      : subDays(to, defaultDays - 1);
  return {
    from,
    to,
    fromStr: format(from, "yyyy-MM-dd"),
    toStr: format(to, "yyyy-MM-dd"),
  };
}

// Phase 1 fetches the full record set and aggregates in-process — simple and
// flexible for the dataset sizes here. For very large datasets this is the
// place to push aggregation into SQL.
export async function loadRecords(): Promise<MetricRecord[]> {
  return prisma.deliveryRecord.findMany({
    select: {
      status: true,
      isRTO: true,
      ndrAttempts: true,
      pincode: true,
      state: true,
      zone: true,
      weight: true,
      codAmount: true,
      orderDate: true,
      pickupDate: true,
      deliveryDate: true,
    },
  });
}

export async function loadFilterOptions(): Promise<{
  zones: string[];
  states: string[];
}> {
  const [zones, states] = await Promise.all([
    prisma.deliveryRecord.findMany({
      distinct: ["zone"],
      select: { zone: true },
      where: { zone: { not: null } },
      orderBy: { zone: "asc" },
    }),
    prisma.deliveryRecord.findMany({
      distinct: ["state"],
      select: { state: true },
      where: { state: { not: null } },
      orderBy: { state: "asc" },
    }),
  ]);
  return {
    zones: zones.map((z) => z.zone).filter((z): z is string => !!z),
    states: states.map((s) => s.state).filter((s): s is string => !!s),
  };
}

export async function hasAnyData(): Promise<boolean> {
  const n = await prisma.deliveryRecord.count();
  return n > 0;
}
