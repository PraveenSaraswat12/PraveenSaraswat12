import { parse as parseDate, isValid } from "date-fns";
import { DeliveryStatus } from "@/generated/prisma/enums";

// Delhivery exports use a mix of day-first Indian formats and ISO. Try the
// most likely formats in order; fall back to the native Date parser.
const DATE_FORMATS = [
  "dd-MM-yyyy HH:mm:ss",
  "dd-MM-yyyy HH:mm",
  "dd-MM-yyyy",
  "dd/MM/yyyy HH:mm:ss",
  "dd/MM/yyyy HH:mm",
  "dd/MM/yyyy",
  "yyyy-MM-dd HH:mm:ss",
  "yyyy-MM-dd'T'HH:mm:ss",
  "yyyy-MM-dd",
  "dd-MMM-yyyy HH:mm",
  "dd-MMM-yyyy",
  "dd MMM yyyy",
  "dd-MMM-yy",
  "MM/dd/yyyy HH:mm",
  "MM/dd/yyyy",
];

export function parseFlexibleDate(value: unknown): Date | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || /^(na|n\/a|null|-|—)$/i.test(s)) return null;

  for (const fmt of DATE_FORMATS) {
    const d = parseDate(s, fmt, new Date());
    if (isValid(d)) return d;
  }
  const native = new Date(s);
  return isValid(native) ? native : null;
}

export function parseNumber(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || /^(na|n\/a|null|-)$/i.test(s)) return null;
  // strip currency symbols, commas, units like "kg"
  const cleaned = s.replace(/[₹,]/g, "").replace(/[a-zA-Z]+$/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const TRUE_TOKENS = new Set(["yes", "y", "true", "1", "rto", "returned", "t"]);

export function parseBoolish(value: unknown): boolean {
  if (value == null) return false;
  return TRUE_TOKENS.has(String(value).trim().toLowerCase());
}

export function parseAttempts(value: unknown): number {
  const n = parseNumber(value);
  if (n == null) return 0;
  return Math.max(0, Math.round(n));
}

export function cleanPincode(value: unknown): string | null {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  // Indian PIN codes are 6 digits; keep the first 6 if extra noise is present.
  return digits.length >= 6 ? digits.slice(0, 6) : digits;
}

export function cleanString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/**
 * Derive a normalised lifecycle status (and whether it's an RTO) from
 * Delhivery's free-text status. RTO detection also folds in an explicit RTO
 * flag column when present.
 */
export function normalizeStatus(
  rawStatus: unknown,
  rtoFlag?: unknown
): { status: DeliveryStatus; isRTO: boolean } {
  const raw = String(rawStatus ?? "").toLowerCase();
  const flagged = rtoFlag !== undefined ? parseBoolish(rtoFlag) : false;

  const isRTO =
    flagged || /\b(rto|return)/.test(raw) || raw.includes("returned to origin");

  let status: DeliveryStatus;
  if (isRTO) {
    status = DeliveryStatus.RTO;
  } else if (/deliver(ed|y done|y completed)/.test(raw) || raw === "dl") {
    status = DeliveryStatus.DELIVERED;
  } else if (raw.includes("out for delivery") || raw === "ofd") {
    status = DeliveryStatus.OUT_FOR_DELIVERY;
  } else if (
    raw.includes("undeliver") ||
    raw.includes("not delivered") ||
    raw.includes("ndr") ||
    raw.includes("attempt")
  ) {
    status = DeliveryStatus.NDR;
  } else if (raw.includes("lost") || raw.includes("damage")) {
    status = DeliveryStatus.LOST;
  } else if (raw.includes("cancel")) {
    status = DeliveryStatus.CANCELLED;
  } else if (
    raw.includes("transit") ||
    raw.includes("dispatch") ||
    raw.includes("in-transit") ||
    raw.includes("shipped")
  ) {
    status = DeliveryStatus.IN_TRANSIT;
  } else if (
    raw.includes("pending") ||
    raw.includes("manifest") ||
    raw.includes("not picked") ||
    raw.includes("pickup")
  ) {
    status = DeliveryStatus.PENDING_PICKUP;
  } else {
    status = DeliveryStatus.UNKNOWN;
  }

  return { status, isRTO };
}
