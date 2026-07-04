"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FIELD_LABELS, type CanonicalField } from "@/lib/csv/mapping";
import { cn } from "@/lib/utils";

interface UploadResult {
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
  error?: string;
}

export function UploadCard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function choose(f: File | null) {
    setFile(f);
    setResult(null);
    setError(null);
  }

  async function upload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data: UploadResult = await res.json();
      if (!res.ok && !data.rejected) {
        setError(data.error || "Upload failed.");
      } else {
        setResult(data);
        if (data.batchId) {
          setFile(null);
          router.refresh();
        }
      }
    } catch {
      setError("Network error during upload.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-primary bg-accent" : "border-input hover:bg-muted/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="hidden"
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-medium">
          Drop a Delhivery MIS export here, or click to browse
        </p>
        <p className="mt-1 text-xs text-muted-foreground">CSV or Excel · up to 25 MB</p>
      </div>

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm">{file.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </span>
          </div>
          <Button size="sm" onClick={upload} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Importing…" : "Import"}
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && <ResultPanel result={result} />}
    </Card>
  );
}

function ResultPanel({ result }: { result: UploadResult }) {
  const ok = !!result.batchId;
  return (
    <div
      className={cn(
        "mt-4 rounded-lg border p-4",
        ok ? "border-success/30 bg-success/5" : "border-warning/40 bg-warning/5"
      )}
    >
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="h-5 w-5 text-success" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-warning" />
        )}
        <span className="font-medium">
          {ok
            ? `Imported ${result.stored.toLocaleString("en-IN")} rows`
            : "Import could not complete"}
        </span>
      </div>

      {ok ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {result.stored.toLocaleString("en-IN")} of{" "}
          {result.totalDataRows.toLocaleString("en-IN")} data rows stored
          {result.errorCount > 0 && ` · ${result.errorCount} skipped (missing AWB)`}
          .
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{result.rejected}</p>
      )}

      {/* Column mapping confirmation */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            Mapped columns
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {result.matched.map((m) => (
              <li key={m.field} className="flex items-center gap-1.5">
                <span className="font-medium">{FIELD_LABELS[m.field]}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">
                  {m.header}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {(result.unmatchedHeaders.length > 0 ||
          result.missingRequired.length > 0) && (
          <div>
            {result.missingRequired.length > 0 && (
              <>
                <p className="text-xs font-semibold text-danger">Missing required</p>
                <p className="mb-2 mt-1 text-sm">
                  {result.missingRequired.map((f) => FIELD_LABELS[f]).join(", ")}
                </p>
              </>
            )}
            {result.unmatchedHeaders.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground">
                  Unmapped headers
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {result.unmatchedHeaders.map((h) => (
                    <span
                      key={h}
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {ok && (
        <div className="mt-4">
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">
              View dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
