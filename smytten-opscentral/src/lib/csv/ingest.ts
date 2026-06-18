import { read, utils } from "xlsx";
import { prisma } from "@/lib/prisma";
import { parseDelhiveryCsv } from "./parse";
import { type CanonicalField, FIELD_LABELS } from "./mapping";

export async function fileToCsvText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return utils.sheet_to_csv(sheet);
  }
  return file.text();
}

export interface IngestResult {
  batchId: string | null;
  fileName: string;
  header: string[];
  totalDataRows: number;
  stored: number;
  errorCount: number;
  matched: { field: CanonicalField; header: string }[];
  unmatchedHeaders: string[];
  missingRequired: CanonicalField[];
  rejected?: string;
}

const CHUNK = 2000;

export async function ingestCsvText({
  csvText,
  fileName,
  userId,
}: {
  csvText: string;
  fileName: string;
  userId?: string | null;
}): Promise<IngestResult> {
  const parsed = parseDelhiveryCsv(csvText);
  const base = {
    fileName,
    header: parsed.header,
    totalDataRows: parsed.totalDataRows,
    errorCount: parsed.errorRows.length,
    matched: parsed.columnMap.matched,
    unmatchedHeaders: parsed.columnMap.unmatchedHeaders,
    missingRequired: parsed.columnMap.missingRequired,
  };

  if (parsed.columnMap.missingRequired.length > 0) {
    return {
      ...base,
      batchId: null,
      stored: 0,
      rejected: `Could not find a column for: ${parsed.columnMap.missingRequired
        .map((f) => FIELD_LABELS[f])
        .join(", ")}. Detected headers: ${parsed.header.join(", ") || "(none)"}`,
    };
  }
  if (parsed.rows.length === 0) {
    return { ...base, batchId: null, stored: 0, rejected: "No valid data rows found." };
  }

  const batch = await prisma.uploadBatch.create({
    data: {
      fileName,
      rowCount: parsed.rows.length,
      errorCount: parsed.errorRows.length,
      sourceHeader: parsed.header.join(", ") || null,
      uploadedById: userId ?? null,
    },
  });

  for (let i = 0; i < parsed.rows.length; i += CHUNK) {
    const slice = parsed.rows
      .slice(i, i + CHUNK)
      .map((r) => ({ ...r, batchId: batch.id }));
    await prisma.deliveryRecord.createMany({ data: slice });
  }

  return { ...base, batchId: batch.id, stored: parsed.rows.length };
}
