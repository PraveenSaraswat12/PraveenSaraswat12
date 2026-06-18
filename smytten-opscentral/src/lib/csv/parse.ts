import Papa from "papaparse";
import { buildColumnMap, type CanonicalField, type ColumnMap } from "./mapping";
import {
  parseFlexibleDate,
  parseNumber,
  parseAttempts,
  cleanPincode,
  cleanString,
  normalizeStatus,
} from "./normalize";
import type { DeliveryStatus } from "@/generated/prisma/client";

export interface NormalizedDeliveryRow {
  awb: string;
  orderDate: Date | null;
  pickupDate: Date | null;
  deliveryDate: Date | null;
  status: DeliveryStatus;
  rawStatus: string | null;
  isRTO: boolean;
  ndrAttempts: number;
  pincode: string | null;
  state: string | null;
  zone: string | null;
  weight: number | null;
  codAmount: number | null;
}

export interface ParseResult {
  header: string[];
  columnMap: ColumnMap;
  rows: NormalizedDeliveryRow[];
  totalDataRows: number;
  errorRows: { rowNumber: number; reason: string }[];
}

export function parseDelhiveryCsv(csvText: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const header = parsed.meta.fields ?? [];
  const columnMap = buildColumnMap(header);

  const get = (row: Record<string, string>, field: CanonicalField) => {
    const col = columnMap.fields[field];
    return col ? row[col] : undefined;
  };

  const rows: NormalizedDeliveryRow[] = [];
  const errorRows: { rowNumber: number; reason: string }[] = [];

  parsed.data.forEach((row, i) => {
    const awb = cleanString(get(row, "awb"));
    // rowNumber accounts for the header line + 1-based indexing.
    const rowNumber = i + 2;
    if (!awb) {
      errorRows.push({ rowNumber, reason: "Missing AWB / waybill" });
      return;
    }

    const rawStatus = cleanString(get(row, "status"));
    const { status, isRTO } = normalizeStatus(rawStatus, get(row, "rtoFlag"));

    rows.push({
      awb,
      orderDate: parseFlexibleDate(get(row, "orderDate")),
      pickupDate: parseFlexibleDate(get(row, "pickupDate")),
      deliveryDate: parseFlexibleDate(get(row, "deliveryDate")),
      status,
      rawStatus,
      isRTO,
      ndrAttempts: parseAttempts(get(row, "ndrAttempts")),
      pincode: cleanPincode(get(row, "pincode")),
      state: cleanString(get(row, "state")),
      zone: cleanString(get(row, "zone")),
      weight: parseNumber(get(row, "weight")),
      codAmount: parseNumber(get(row, "codAmount")),
    });
  });

  return {
    header,
    columnMap,
    rows,
    totalDataRows: parsed.data.length,
    errorRows,
  };
}
