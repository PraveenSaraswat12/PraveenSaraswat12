import Anthropic from "@anthropic-ai/sdk";
import { anthropicModel } from "./config";
import type { EmailRule } from "./rules";

export interface ExtractionOutput {
  data: Record<string, unknown>;
  confidence: number | null;
  model: string;
}

/**
 * Use Claude to extract the category's structured fields from a matched email.
 * Returns a flat object keyed by rule.extractFields plus a confidence score.
 */
export async function extractEmailFields(
  rule: EmailRule,
  email: { from: string; subject: string; body: string }
): Promise<ExtractionOutput> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const model = anthropicModel();

  const fieldList = rule.extractFields.map((f) => `- ${f}`).join("\n");
  const system =
    "You extract structured data from operational emails for an Indian D2C e-commerce ops team (Smytten). " +
    "Return ONLY a single JSON object — no prose, no markdown fences. Use null for any field not present. " +
    "Amounts are in INR; return numbers without currency symbols or commas. Dates as YYYY-MM-DD when possible.";

  const prompt = `Category: ${rule.label}
Extract these fields:
${fieldList}

Also include a numeric "confidence" between 0 and 1 for the overall extraction.

Email:
From: ${email.from}
Subject: ${email.subject}
Body:
${email.body.slice(0, 8000)}`;

  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    temperature: 0,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const parsed = safeJson(text);
  const confidence =
    typeof parsed.confidence === "number" ? (parsed.confidence as number) : null;
  delete parsed.confidence;

  return { data: parsed, confidence, model };
}

function safeJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}
