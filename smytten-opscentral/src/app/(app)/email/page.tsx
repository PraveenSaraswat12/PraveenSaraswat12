import { Mail, Bot, KeyRound, CheckCircle2, XCircle, Clock } from "lucide-react";
import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { ChartCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { EMAIL_RULES } from "@/lib/email/rules";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EmailPage() {
  await requireRole(["OPS_EXEC", "OPS_LEAD", "FINANCE"]);

  const gmailReady = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  const anthropicReady = !!process.env.ANTHROPIC_API_KEY;
  const cronReady = !!process.env.CRON_SECRET;

  return (
    <>
      <PageHeader
        title="Email Intelligence"
        description="Auto-extract chargebacks, courier escalations & inward updates from Gmail"
      />

      <div className="space-y-6 p-4 sm:p-6">
        {!(gmailReady && anthropicReady) && (
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
            <p className="font-medium">Setup required</p>
            <p className="mt-1 text-muted-foreground">
              Connect a Gmail account and add an Anthropic API key to enable
              inbox scanning. Matched emails are parsed by Claude into structured
              records and land in a review queue before going live.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatusCard
            icon={Mail}
            label="Gmail connection"
            ready={gmailReady}
            detail={gmailReady ? "OAuth configured" : "GOOGLE_CLIENT_ID not set"}
          />
          <StatusCard
            icon={Bot}
            label="Claude parsing"
            ready={anthropicReady}
            detail={
              anthropicReady
                ? `Model ${process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6"}`
                : "ANTHROPIC_API_KEY not set"
            }
          />
          <StatusCard
            icon={KeyRound}
            label="Cron scan (6h)"
            ready={cronReady}
            detail={cronReady ? "CRON_SECRET configured" : "CRON_SECRET not set"}
          />
        </div>

        <ChartCard
          title="Keyword rules"
          description="Messages are matched per category, then parsed into structured fields"
        >
          <div className="space-y-4">
            {EMAIL_RULES.map((rule) => (
              <div
                key={rule.category}
                className="rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{rule.label}</span>
                  <Badge variant="secondary">{rule.category}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rule.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                  <RuleBit
                    label="Sender"
                    values={rule.senders.length ? rule.senders : ["any"]}
                  />
                  <RuleBit label="Keywords" values={rule.keywords} />
                  {rule.requireBrand && <RuleBit label="Requires" values={["brand match"]} />}
                  <RuleBit label="Extracts" values={rule.extractFields} mono />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="Review queue"
          description="Extracted records await confirmation before going live"
        >
          <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
            <Clock className="mb-2 h-6 w-6" />
            No pending records. Enable scanning to populate the queue.
          </div>
        </ChartCard>
      </div>
    </>
  );
}

function StatusCard({
  icon: Icon,
  label,
  ready,
  detail,
}: {
  icon: typeof Mail;
  label: string;
  ready: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {label}
          {ready ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className={cn("mt-0.5 text-xs", ready ? "text-success" : "text-muted-foreground")}>
          {detail}
        </div>
      </div>
    </div>
  );
}

function RuleBit({
  label,
  values,
  mono,
}: {
  label: string;
  values: string[];
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={mono ? "font-mono" : undefined}>{values.join(", ")}</span>
    </div>
  );
}
