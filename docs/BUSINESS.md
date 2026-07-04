# Kithra Insight — Business Plan

_Owner: Praveen Saraswat · June 2026_

## One-liner

**"Where data becomes decisions."** Drop in any file — Excel, PDF, CSV, code,
or a web link — answer five smart questions, and get connected, interactive
dashboards plus an AI analyst that answers anything about your data, with
every number actually computed from it.

## The wedge (why this wins attention)

| Alternative | Pain | Insight's answer |
|---|---|---|
| Excel + pivot tables | Hours of manual setup per report; breaks on refresh | 3 minutes, zero formulas, re-upload to refresh |
| ChatGPT + file upload | Hallucinated numbers; data leaves the company | Numbers computed by a deterministic engine; data never leaves the browser |
| Power BI (~$14/user/mo) | Steep learning curve, modelling required | Asks YOU the questions; dashboards design themselves |
| Tableau (~$75/user/mo) | Price + complexity for SMBs | $0 to start, $30 for serious use |

Three differentiators to repeat everywhere: **private-by-design** (analysis
in the browser), **asks-before-it-builds** (the clarifying-questions wizard),
**grounded answers** (chat numbers come from the query engine, not the LLM).

## Who it's for (ICP)

1. **Ops / supply-chain / finance professionals at Indian SMBs** — receivables
   aging, dispatch performance, inventory health. (The founder's own world —
   credible distribution through his network and content.)
2. **Freelance analysts & consultants** — instant client-ready dashboards.
3. **Students & first-jobbers** — free tier as the hook, habit formation.

Primary launch use-case: **receivables aging for Indian SMBs** (the 30/60/90
overdue story every business owner feels in their stomach).

## Pricing & packaging

| | Free | Pro $30/mo · $300/yr | Premium $90/mo · $900/yr | Enterprise |
|---|---|---|---|---|
| Job | Habit & wow | The working analyst | The data-driven operator | Teams & control |
| Hook | Sample-to-dashboard in 1 click | Cloud AI + bigger files + exports + backups | Forecasts & projections, unlimited everything | SSO, residency, support |

- Pro maps to the existing Kithra backend plan `plus`, Premium to `premium` —
  **one subscription works across all Kithra products** (audio + data). That
  is both an upsell story ("Kithra One") and zero extra payments work.
- Razorpay checkout = cards, UPI, netbanking, wallets out of the box;
  INR billing in India, USD elsewhere. Yearly = 2 months free.
- Enterprise is a mailto pipeline until there are ≥3 serious conversations.

## Unit economics (sketch)

- Hosting: GitHub Pages = ₹0. Supabase free tier covers auth + AI proxy at
  early scale.
- Marginal cost ≈ cloud-AI calls only, and they are **capped per plan**
  (10/200/1000 questions/day) with the local engine answering the common
  questions for free. Gross margin stays >90% by construction.
- Free tier costs ~nothing (local-only AI), so CAC can be content-led.

## Funnel & conversion levers

1. **Activation** = first dashboard within 5 minutes. The "Try sample data"
   button exists precisely for this; track manually at first.
2. Free→Pro levers: 2 MB file cap (real exports are bigger), cloud AI
   answers on ambiguous questions, CSV export, encrypted backups.
3. Pro→Premium levers: forecasts & trend projections, unlimited datasets.
4. Churn defense: workspaces accumulate on-device → switching cost is real
   but user-respecting (export anytime).

## Launch plan (first 60 days)

1. LinkedIn: 3 posts/week in supply-chain & MSME finance communities —
   each post = one real analysis story with screenshots (aging, regional
   concentration, forecast).
2. Three template datasets + walkthroughs: Receivables, Sales performance,
   Inventory aging.
3. Product Hunt + r/dataanalysis once 20 organic users are active.
4. WhatsApp-able demo: the live URL works on phones — demo in person at
   MSME meetups.

## Metrics that matter

Activation rate (upload→dashboard), D7 retention, AI questions/user/day,
free→paid conversion, MRR. Revisit pricing when free→paid > 4%.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Web import blocked by CORS on some sites | Two public mirrors + clear "export as file instead" guidance |
| Client-only limits (very large files) | Caps per plan; roadmap: chunked parsing + WebWorkers |
| Payments edge cases internationally | Razorpay handles cards/UPI; USD pricing for non-India |
| Single-founder support load | FAQ + email SLA; Enterprise only when revenue justifies |

## 6-month roadmap

1. Encrypted cloud sync (table is ready — `setup/supabase.sql`).
2. Scheduled email digests of insights (Supabase cron + edge function).
3. Team workspaces (shared encryption keys) → unlocks real Enterprise.
4. Public read-only dashboard links (watermarked on Free — viral loop).
5. What-if scenario modelling (Premium).
6. WebWorker parsing for 100 MB+ files.
