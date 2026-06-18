import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { gmailConfigured, anthropicConfigured, gmailThreadUrl } from "./config";
import { matchEmail } from "./rules";
import {
  getValidAccessToken,
  buildGmailQuery,
  listMessageIds,
  getMessage,
} from "./gmail";
import { extractEmailFields } from "./parse";

export interface ScanResult {
  ok: boolean;
  reason?: string;
  scanned: number;
  matched: number;
  created: number;
  updated: number;
  skipped: number;
}

export async function scanInbox(opts?: {
  lookbackDays?: number;
  maxMessages?: number;
}): Promise<ScanResult> {
  const base = { scanned: 0, matched: 0, created: 0, updated: 0, skipped: 0 };

  if (!gmailConfigured()) {
    return { ok: false, reason: "Gmail is not configured (GOOGLE_CLIENT_ID/SECRET).", ...base };
  }
  if (!anthropicConfigured()) {
    return { ok: false, reason: "Anthropic API key not set (ANTHROPIC_API_KEY).", ...base };
  }
  const conn = await prisma.gmailConnection.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!conn) {
    return { ok: false, reason: "No Gmail account connected.", ...base };
  }

  const lookbackDays = opts?.lookbackDays ?? 2;
  const maxMessages = opts?.maxMessages ?? 25;

  const token = await getValidAccessToken(conn);
  const ids = await listMessageIds(token, buildGmailQuery(lookbackDays), maxMessages);

  const result = { ...base };
  for (const id of ids) {
    const email = await getMessage(token, id);
    result.scanned++;

    const match = matchEmail(email.from, `${email.subject}\n${email.body}`);
    if (!match) continue;
    result.matched++;

    const existing = await prisma.emailExtraction.findUnique({
      where: {
        threadId_category: { threadId: email.threadId, category: match.category },
      },
    });
    if (existing && existing.status !== "PENDING") {
      result.skipped++;
      continue;
    }

    const extracted = await extractEmailFields(match.rule, email);
    const dataJson = extracted.data as Prisma.InputJsonValue;

    await prisma.emailExtraction.upsert({
      where: {
        threadId_category: { threadId: email.threadId, category: match.category },
      },
      create: {
        category: match.category,
        status: "PENDING",
        source: "EMAIL",
        threadId: email.threadId,
        messageId: email.id,
        emailDate: email.date,
        subject: email.subject,
        fromAddress: email.from,
        gmailThreadUrl: gmailThreadUrl(email.threadId),
        data: dataJson,
        model: extracted.model,
        confidence: extracted.confidence,
        rawSnippet: email.snippet,
      },
      update: {
        data: dataJson,
        model: extracted.model,
        confidence: extracted.confidence,
        messageId: email.id,
        emailDate: email.date,
        rawSnippet: email.snippet,
      },
    });

    if (existing) result.updated++;
    else result.created++;
  }

  return { ok: true, ...result };
}
