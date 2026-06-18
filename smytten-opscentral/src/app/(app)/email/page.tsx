import { format } from "date-fns";
import { Mail, Bot, KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ChartCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ReviewQueue,
  ScanButton,
  type ReviewItem,
} from "@/components/email-review";
import { EMAIL_RULES } from "@/lib/email/rules";
import { gmailConfigured, anthropicConfigured, anthropicModel } from "@/lib/email/config";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  gmail_not_configured: "Gmail OAuth is not configured on the server.",
  oauth_state: "OAuth state mismatch — please try connecting again.",
  oauth_denied: "Gmail access was denied.",
  oauth_failed: "Could not complete the Gmail connection.",
};

export default async function EmailPage({
  searchParams,
}: {
  searchParams: { error?: string; connected?: string };
}) {
  await requireRole(["OPS_EXEC", "OPS_LEAD", "FINANCE"]);

  const gmailReady = gmailConfigured();
  const anthropicReady = anthropicConfigured();
  const cronReady = !!process.env.CRON_SECRET;

  const [connection, pending, confirmed, rejected] = await Promise.all([
    prisma.gmailConnection.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.emailExtraction.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.emailExtraction.count({ where: { status: "CONFIRMED" } }),
    prisma.emailExtraction.count({ where: { status: "REJECTED" } }),
  ]);

  const canScan = gmailReady && anthropicReady && !!connection;

  const items: ReviewItem[] = pending.map((p) => ({
    id: p.id,
    category: p.category,
    subject: p.subject,
    fromAddress: p.fromAddress,
    emailDate: p.emailDate ? format(p.emailDate, "d MMM yyyy") : null,
    gmailThreadUrl: p.gmailThreadUrl,
    confidence: p.confidence,
    model: p.model,
    data: (p.data as Record<string, unknown>) ?? {},
  }));

  return (
    <>
      <PageHeader
        title="Email Intelligence"
        description="Auto-extract chargebacks, courier escalations & inward updates from Gmail"
      >
        {canScan && <ScanButton />}
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-6">
        {searchParams?.error && (
          <div className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
            {ERROR_MESSAGES[searchParams.error] ?? "Something went wrong."}
          </div>
        )}
        {searchParams?.connected && (
          <div className="rounded-lg border border-success/40 bg-success/5 p-3 text-sm text-success">
            Gmail connected{connection ? ` as ${connection.email}` : ""}.
          </div>
        )}

        {!(gmailReady && anthropicReady) && (
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
            <p className="font-medium">Setup required</p>
            <p className="mt-1 text-muted-foreground">
              Add an Anthropic API key and Google OAuth credentials to enable
              inbox scanning. Matched emails are parsed by Claude into structured
              records and land in the review queue below before going live.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatusCard
            icon={Mail}
            label="Gmail connection"
            ready={!!connection}
            detail={
              connection
                ? `Connected · ${connection.email}`
                : gmailReady
                ? "Not connected"
                : "GOOGLE_CLIENT_ID not set"
            }
            action={
              gmailReady && !connection ? (
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <a href="/api/gmail/connect">Connect Gmail</a>
                </Button>
              ) : null
            }
          />
          <StatusCard
            icon={Bot}
            label="Claude parsing"
            ready={anthropicReady}
            detail={anthropicReady ? `Model ${anthropicModel()}` : "ANTHROPIC_API_KEY not set"}
          />
          <StatusCard
            icon={KeyRound}
            label="Cron scan (6h)"
            ready={cronReady}
            detail={cronReady ? "POST /api/email/scan + Bearer" : "CRON_SECRET not set"}
          />
        </div>

        <ChartCard
          title="Review queue"
          description={`${items.length} pending · ${confirmed} confirmed · ${rejected} rejected`}
        >
          <ReviewQueue items={items} />
        </ChartCard>

        <ChartCard
          title="Keyword rules"
          description="Messages are matched per category, then parsed into structured fields"
        >
          <div className="space-y-4">
            {EMAIL_RULES.map((rule) => (
              <div key={rule.category} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{rule.label}</span>
                  <Badge variant="secondary">{rule.category}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                  <RuleBit label="Sender" values={rule.senders.length ? rule.senders : ["any"]} />
                  <RuleBit label="Keywords" values={rule.keywords} />
                  {rule.requireBrand && <RuleBit label="Requires" values={["brand match"]} />}
                  <RuleBit label="Extracts" values={rule.extractFields} mono />
                </div>
              </div>
            ))}
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
  action,
}: {
  icon: typeof Mail;
  label: string;
  ready: boolean;
  detail: string;
  action?: React.ReactNode;
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
        {action}
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
