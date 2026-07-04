"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Loader2,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { reviewExtraction } from "@/app/(app)/email/actions";
import { cn } from "@/lib/utils";

export interface ReviewItem {
  id: string;
  category: string;
  subject: string | null;
  fromAddress: string | null;
  emailDate: string | null;
  gmailThreadUrl: string | null;
  confidence: number | null;
  model: string | null;
  data: Record<string, unknown>;
}

const CATEGORY_LABEL: Record<string, string> = {
  CHARGEBACK: "Chargeback",
  COURIER_ESCALATION: "Courier escalation",
  INWARD: "Inward",
  OTHER: "Other",
};

export function ScanButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function scan() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/email/scan", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setMsg(
          `Scanned ${data.scanned} · matched ${data.matched} · ${data.created} new, ${data.updated} updated, ${data.skipped} skipped`
        );
        router.refresh();
      } else {
        setMsg(data.reason || data.error || "Scan failed.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" onClick={scan} disabled={disabled || loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Scan inbox now
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}

export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
        <Mail className="mb-2 h-6 w-6" />
        No pending records. Run a scan to populate the queue.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ReviewCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function ReviewCard({ item }: { item: ReviewItem }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"CONFIRMED" | "REJECTED" | null>(null);

  function decide(decision: "CONFIRMED" | "REJECTED") {
    setDone(decision);
    startTransition(async () => {
      try {
        await reviewExtraction(item.id, decision);
      } catch {
        setDone(null);
      }
    });
  }

  const fields = Object.entries(item.data).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-opacity",
        done && "opacity-50"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{CATEGORY_LABEL[item.category] ?? item.category}</Badge>
            {item.confidence != null && (
              <span className="text-xs text-muted-foreground">
                {Math.round(item.confidence * 100)}% confidence
              </span>
            )}
            <span className="text-xs text-muted-foreground">source=EMAIL</span>
          </div>
          <div className="mt-1.5 truncate text-sm font-medium">
            {item.subject || "(no subject)"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {item.fromAddress} · {item.emailDate}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => decide("CONFIRMED")}
            disabled={pending || !!done}
            className="border-success/40 text-success hover:bg-success/10"
          >
            <Check className="h-4 w-4" />
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => decide("REJECTED")}
            disabled={pending || !!done}
            className="border-danger/40 text-danger hover:bg-danger/10"
          >
            <X className="h-4 w-4" />
            Reject
          </Button>
        </div>
      </div>

      {fields.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-3">
          {fields.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="truncate font-medium">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {item.gmailThreadUrl && (
        <a
          href={item.gmailThreadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open Gmail thread
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
