import { prisma } from "@/lib/prisma";
import { GMAIL_SCOPES, gmailRedirectUri } from "./config";
import { EMAIL_RULES } from "./rules";
import type { GmailConnection } from "@/generated/prisma/client";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: gmailRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: gmailRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const json = await res.json();

  const userRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  const user = userRes.ok ? await userRes.json() : {};

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in ?? 3600,
    email: user.email ?? "unknown",
  };
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const json = await res.json();
  return { accessToken: json.access_token, expiresIn: json.expires_in ?? 3600 };
}

/** Returns a valid access token, refreshing and persisting it if expired. */
export async function getValidAccessToken(conn: GmailConnection): Promise<string> {
  const stillValid =
    conn.accessToken && conn.expiresAt && conn.expiresAt.getTime() > Date.now() + 60_000;
  if (stillValid) return conn.accessToken!;

  const { accessToken, expiresIn } = await refreshAccessToken(conn.refreshToken);
  await prisma.gmailConnection.update({
    where: { id: conn.id },
    data: {
      accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    },
  });
  return accessToken;
}

export function buildGmailQuery(lookbackDays: number): string {
  const senders = new Set<string>();
  const keywords = new Set<string>();
  for (const rule of EMAIL_RULES) {
    rule.senders.forEach((s) => senders.add(s));
    rule.keywords.forEach((k) => keywords.add(k));
  }
  const ors = [
    ...Array.from(senders).map((s) => `from:${s}`),
    ...Array.from(keywords).map((k) => `subject:${JSON.stringify(k)}`),
  ];
  return `newer_than:${lookbackDays}d (${ors.join(" OR ")})`;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: Date | null;
  snippet: string;
  body: string;
}

export async function listMessageIds(
  accessToken: string,
  query: string,
  maxResults: number
): Promise<string[]> {
  const url = `${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail list failed: ${await res.text()}`);
  const json = await res.json();
  return (json.messages ?? []).map((m: { id: string }) => m.id);
}

interface GmailPayloadPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
}

function extractPlainText(part: GmailPayloadPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  if (part.parts) {
    for (const p of part.parts) {
      const t = extractPlainText(p);
      if (t) return t;
    }
  }
  // Fallback: strip HTML
  if (part.mimeType === "text/html" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url")
      .toString("utf8")
      .replace(/<[^>]+>/g, " ");
  }
  return "";
}

export async function getMessage(
  accessToken: string,
  id: string
): Promise<GmailMessage> {
  const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail get failed: ${await res.text()}`);
  const json = await res.json();

  const headers: { name: string; value: string }[] = json.payload?.headers ?? [];
  const header = (n: string) =>
    headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";

  const dateRaw = header("Date");
  const parsedDate = dateRaw ? new Date(dateRaw) : null;

  return {
    id: json.id,
    threadId: json.threadId,
    from: header("From"),
    subject: header("Subject"),
    date: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null,
    snippet: json.snippet ?? "",
    body: extractPlainText(json.payload).slice(0, 12_000),
  };
}
