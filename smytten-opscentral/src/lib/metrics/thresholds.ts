// RAG thresholds for the Ops Leadership view.
//   P-to-D >= 85%   RTO <= 12%   NDR attempts <= 1.5 avg
// "Amber" = within 5% (relative) of the threshold; "Red" = breach beyond that.

export type Rag = "green" | "amber" | "red";

export type Direction = "higher-better" | "lower-better";

export interface Threshold {
  key: "p2d" | "rto" | "ndr" | "tat";
  label: string;
  target: number;
  direction: Direction;
  unit: "%" | "avg" | "days";
  amberBandPct: number; // relative band around target, in %
}

export const THRESHOLDS: Record<Threshold["key"], Threshold> = {
  p2d: {
    key: "p2d",
    label: "Picked → Delivered",
    target: 85,
    direction: "higher-better",
    unit: "%",
    amberBandPct: 5,
  },
  rto: {
    key: "rto",
    label: "RTO",
    target: 12,
    direction: "lower-better",
    unit: "%",
    amberBandPct: 5,
  },
  ndr: {
    key: "ndr",
    label: "Avg NDR attempts",
    target: 1.5,
    direction: "lower-better",
    unit: "avg",
    amberBandPct: 5,
  },
  tat: {
    key: "tat",
    label: "TAT breach (5-day SLA)",
    target: 10,
    direction: "lower-better",
    unit: "%",
    amberBandPct: 5,
  },
};

export function ragFor(value: number, t: Threshold): Rag {
  const band = (t.target * t.amberBandPct) / 100;
  if (t.direction === "higher-better") {
    if (value >= t.target) return "green";
    if (value >= t.target - band) return "amber";
    return "red";
  }
  // lower-better
  if (value <= t.target) return "green";
  if (value <= t.target + band) return "amber";
  return "red";
}

export const RAG_LABEL: Record<Rag, string> = {
  green: "On target",
  amber: "At risk",
  red: "Breach",
};

export const RAG_BADGE_VARIANT: Record<Rag, "success" | "warning" | "danger"> = {
  green: "success",
  amber: "warning",
  red: "danger",
};
