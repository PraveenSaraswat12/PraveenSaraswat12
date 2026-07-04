// Configurable keyword rules per email category (Phase-1 item 6).
// A message matches a category when the sender matches one of `senders`
// (substring on the From address) AND any of `keywords` appears in the
// subject/body. INWARD additionally requires a known brand name.

export type EmailCategory =
  | "CHARGEBACK"
  | "COURIER_ESCALATION"
  | "INWARD"
  | "OTHER";

export interface EmailRule {
  category: EmailCategory;
  label: string;
  senders: string[];
  keywords: string[];
  requireBrand?: boolean;
  description: string;
  /** Fields the LLM step should extract for this category. */
  extractFields: string[];
}

// Inward brand list — fill with the brands Smytten inwards/dispatches.
export const BRAND_LIST: string[] = [
  // "Brand A", "Brand B", ...
];

export const EMAIL_RULES: EmailRule[] = [
  {
    category: "CHARGEBACK",
    label: "Chargeback / Credit Note",
    senders: ["shiprocket"],
    keywords: ["chargeback", "CN", "credit note"],
    description:
      "Shiprocket chargebacks and credit notes — capture CN number, amount, AWB and reason.",
    extractFields: ["cnNumber", "amount", "awb", "reason", "raisedOn"],
  },
  {
    category: "COURIER_ESCALATION",
    label: "Courier Escalation",
    senders: ["delhivery.com"],
    keywords: ["escalation", "breach", "short"],
    description:
      "Delhivery escalations — SLA breaches, shortages and disputes.",
    extractFields: ["awb", "issueType", "amount", "slaBreached", "summary"],
  },
  {
    category: "INWARD",
    label: "Inward / Dispatch",
    senders: [],
    keywords: ["inward", "dispatch", "delay"],
    requireBrand: true,
    description:
      "Inward/dispatch updates and delays for tracked brands — capture brand, quantity, expected vs actual date.",
    extractFields: ["brand", "quantity", "expectedDate", "actualDate", "status"],
  },
];

export interface EmailMatch {
  category: EmailCategory;
  rule: EmailRule;
  matchedKeywords: string[];
  matchedBrand?: string;
}

/** Returns the first matching rule for a message, or null. */
export function matchEmail(
  from: string,
  text: string
): EmailMatch | null {
  const lowerFrom = from.toLowerCase();
  const lowerText = text.toLowerCase();

  for (const rule of EMAIL_RULES) {
    const senderOk =
      rule.senders.length === 0 ||
      rule.senders.some((s) => lowerFrom.includes(s.toLowerCase()));
    if (!senderOk) continue;

    const matchedKeywords = rule.keywords.filter((k) =>
      lowerText.includes(k.toLowerCase())
    );
    if (matchedKeywords.length === 0) continue;

    let matchedBrand: string | undefined;
    if (rule.requireBrand) {
      matchedBrand = BRAND_LIST.find((b) =>
        lowerText.includes(b.toLowerCase())
      );
      if (BRAND_LIST.length > 0 && !matchedBrand) continue;
    }

    return { category: rule.category, rule, matchedKeywords, matchedBrand };
  }
  return null;
}
