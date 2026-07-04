# Kithra Insight — Supervisor Review (final pre-production audit)

_Reviewer: Agent 6 (Supervisor) · Date: 2026-07-04 · Branch: `claude/focused-albattani-uyb66y`_

Independent audit of `insight-src/` (source) and its single-file build
`insight/index.html`, served by GitHub Pages at
`https://praveensaraswat12.github.io/PraveenSaraswat12/insight/`. I did not
write this code and reviewed it as an outside auditor against the owner's
9-point spec.

---

## 1. Verification results (exact)

Run in `/home/user/PraveenSaraswat12/insight-src`, Node v22.22.2, npm 10.9.7.

| Command | Result | Detail |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **PASS** (exit 0) | Zero type errors, TS strict. |
| `npx vitest run` | **PASS** (exit 0) | **4 files, 67 tests, 67 passed**, ~6.0s. Non-fatal React `act(...)` console warnings only. |
| `npm run build` (`vite build`) | **PASS** (exit 0) | 87 modules → single file `../insight/index.html` = **896.16 kB (gzip 300.03 kB)**. |

The rebuild produced a **byte-identical** artifact: `git status` stayed clean
and `git diff -- insight/index.html` was empty, so the committed artifact
faithfully matches source. All three gates green.

## 2. Repo hygiene

- `git status --short`: **clean** (before and after rebuild).
- Root app untouched this session: root `index.html` last changed in
  `f3be429` (2026-06-12 13:23). Every "Insight" commit — scaffold `00f7517`
  (2026-06-12 **18:41**, same day) through `087283d` (2026-07-04) — is
  **after** it. `git diff -- index.html books/` is empty. Root `index.html`
  (489,782 B, dated Jun 12 18:27) and `insight/index.html` (896,874 B) are
  distinct files.
- Runtime safety confirmed: `security.eraseAllLocalData()` deletes only
  `ki_*` / `kithra_insight_*` keys (spares root-Kithra keys), verified by
  test `wipes Insight data but spares root-Kithra keys`.
- No secrets committed: no `service_role` key, no Razorpay keys, no private
  keys. Only the Supabase **anon** key (public by design; RLS-protected).

## 3. Requirements traceability

| # | Requirement | Implementation | Covering test(s) | Status |
|---|---|---|---|---|
| 1 | Upload Excel/PDF/CSV/JSON/code/web → full context | `engine/io/files.ts` (xlsx/xls/ods, csv/tsv, json, pdf via `io/cdn.ts` pdf.js, code+text extraction: markdown/JSON/SQL/CSV blocks), `io/web.ts` (HTML/JSON/CSV via direct + `corsproxy.io`/`allorigins.win`) | engine.test.ts "file ingestion" (JSON, markdown, SQL INSERT, code-as-context, broken-file-in-batch), "web ingestion" (HTML tables, JSON APIs, non-http reject) | **PASS** |
| 2 | Ask clarifying questions before building (needs, filters, aging-from-date, tables) | `engine/wizard.ts` — goal, dateColumn, **aging buckets**, filters, KPIs, compareBy, each with a `why` explanation; `stores.startWizard/applyWizard` gate dashboards on answers | engine.test.ts "asks the right questions and decodes answers"; app.test.tsx end-to-end wizard step | **PASS** |
| 3 | Interactive dashboards, multiple, cross-filtered ("talking") | `engine/dashboards.ts` (one dashboard **per rich table**; KPI/line/bar/donut/aging; `drillFilterColumn`), `stores.crossFilter` + `mergedQuery` (merge by column name), `ui/charts/WidgetView.tsx` `onSlice` | engine.test.ts "designs dashboards whose every query runs"; app.test.tsx crossFilter + mergedQuery toggle | **PASS** |
| 4 | Chat answers anything: permutations, forecasts, pivots, %, aging, line comparison, tables | `engine/nl.ts` — aging, forecast (OLS 3-mo), versus, trend (line), pivot, share/%, top-N, KPI, meta, graceful fallback; cloud fallback only on low-confidence + consent + paid + non-guest | engine.test.ts "NL analyst" (14 tests incl. forecast, aging, share, vs, describeDataForAI ships facts not rows) | **PASS** |
| 5 | Login → purchase, multiple payment methods | `pages/Auth.tsx` (Google / phone-OTP / guest), `security/auth.ts`, `billing/checkout.ts` (Razorpay: cards/UPI/netbanking/wallets), `platform/cloud.ts` | billing.test.ts "checkout" (paid order→razorpay→verify→refresh, dismiss, unreachable→labelled 7-day preview, free/enterprise/guest rejection); app.test.tsx auth page | **PASS**¹ |
| 6 | Plans free/pro/premium/enterprise, pricing & gating | `billing/plans.ts` (4 tiers: $0 / $30 / $90 / custom, yearly = 2 months free), `entitlements.ts` (sources, file MB, AI/day, exports, cloud AI enforced), `pages/Pricing.tsx` | billing.test.ts "plans" (four tiers, monotonic limits, backend map) + "entitlements" (gating, demo expiry, usage cap) | **PASS** (see MAJOR-1) |
| 7 | Encryption at rest, secure long-term storage, security at every stage | `security/vault.ts` (AES-256-GCM, random 256-bit device key, fresh 96-bit IV; PBKDF2 250k for passphrase backups), `store.ts` (encrypted IndexedDB, plaintext = counts only), consent default-off, `docs/SECURITY.md` | security.test.ts (roundtrip, tamper-detect, fresh IV, no-plaintext, passphrase roundtrip + wrong-pass fail, erase spares root, consent off) | **PASS**² |
| 8 | Professional, futuristic, simple, mobile-friendly | `pages/Landing.tsx` + `styles/` (glass, gradients, animated hero); responsive `sm:`/`lg:` grids, `overflow-x-auto` tables, sticky nav | app.test.tsx "renders the landing page with brand and CTAs" | **PASS** |
| 9 | QA green, production-ready | typecheck + 67 tests + build all green | full suite | **PASS** |

¹ Req 5 carries documented **deployment dependencies** (not defects) — see Known Limitations.
² Device key co-located in `localStorage`; honestly disclosed in SECURITY.md (see NOTE-1).

## 4. Findings

### BLOCKER
**None.** Zero blockers.

### MAJOR
- **MAJOR-1 — "What-if scenarios" is sold but not implemented (paid-tier copy vs. reality).**
  Premium markets **"What-if scenarios & forecasts"** (`billing/plans.ts:68`,
  Pricing limits table, `BUSINESS.md`). The entitlement `canUseScenarios()`
  (`entitlements.ts:170`) is exported and unit-tested but **never consumed by
  any UI feature** — there is no scenario builder anywhere in the product.
  Meanwhile the **forecast** half genuinely works but is **ungated on every
  plan** (`nl.ts:283` runs for Free; `stores.suggestions()` even prompts Free
  users with *"Forecast … next 3 months"*). Net: a $90/mo Premium subscriber's
  headline differentiator is half-absent and half-free-to-everyone. Not a
  blocker (forecasts work; no broken flow; fix is copy-level), but it should be
  corrected before serious paid promotion. **Fix (small):** reword the bullet
  to "Forecasts" and mark scenarios "(roadmap)" — exactly as the Enterprise
  features already are — **or** gate `forecast` behind `canUseScenarios()` and
  ship an actual scenario tool.

### MINOR
- **MINOR-1 — Two advertised limits are not enforced.** `maxRowsPerTable`
  (Free 20k … 1M) and `maxWorkspaces` (Free 2 / Pro 15) are shown in the
  Pricing table but enforced **nowhere** in code — only `maxSources`,
  `maxFileMB`, `aiQuestionsPerDay`, `exports`, `cloudAI` are gated. This is
  *under*-enforcement (generous to users), so low risk today, but the pricing
  table states numbers the product doesn't hold to. Tighten before it becomes a
  monetization leak.
- **MINOR-2 — React `act(...)` warnings in the UI test run.** `app.test.tsx`
  emits several "update … not wrapped in act(...)" warnings. All 67 tests pass,
  but the console noise weakens QA signal and can mask real warnings later;
  worth wrapping the async state updates.
- **MINOR-3 — Web import depends on third-party public CORS mirrors.** The
  "upload a web reference" feature falls back to `corsproxy.io` /
  `allorigins.win` when a site blocks direct browser fetch (`io/web.ts:11`).
  These are free public services with no SLA; if they rate-limit or disappear,
  web import silently degrades to the direct-fetch path only. Disclosed in
  SECURITY.md/BUSINESS.md, but it is an external single-point dependency for a
  marketed capability.

### NOTE (honest known limitations — mostly documented, no action required to ship)
- **NOTE-1 — At-rest encryption scope.** The AES-256 device key lives in
  `localStorage` next to the encrypted IndexedDB payload, so at-rest encryption
  does **not** defend against malware or an unlocked browser profile on the same
  device. This is standard for a passwordless local app and is **explicitly and
  honestly disclosed** in `SECURITY.md` ("Honest limitations & roadmap"). The
  passphrase-protected `.kithra` backups (PBKDF2 250k) are the genuinely strong,
  user-secret-bound path. Landing/Auth/Pricing security copy is accurate
  ("encrypted on your device", "raw rows never uploaded", "AES-256").
- **NOTE-2 — Supabase OAuth redirect allow-list.** Google sign-in uses
  `redirectTo = origin + pathname` (i.e. the `/insight/` path). Until the owner
  adds `https://praveensaraswat12.github.io/PraveenSaraswat12/insight/` to the
  Supabase Redirect URLs, Google returns to the root Kithra page (still signed
  in). Documented for the owner in `USER_GUIDE.md` §"Two optional one-time
  setups". Phone-OTP and guest are unaffected.
- **NOTE-3 — Payments reuse root-app plan ids.** `checkout` sends backend plan
  ids `plus`/`premium` to the existing `/functions/v1/payments` edge function
  (`plans.ts`, `cloud.ts`), so one subscription spans all Kithra products. If
  the payments backend is unreachable, checkout activates a clearly-labelled
  **7-day demo** (no charge) — good failure UX. Requires a real (non-guest)
  cloud session to purchase, by design.
- **NOTE-4 — Cloud AI response-shape assumption.** `cloudAI()` reads
  `j.text || j.answer || j.result || ''`; if the edge function returns a
  different shape it yields `''` and the chat **keeps the trustworthy local
  answer** (`stores.ts` only overrides when cloud text is non-empty). Safe by
  construction.
- **NOTE-5 — Currency by timezone.** INR is chosen only for
  `Asia/Kolkata`/`Asia/Calcutta` timezones, else USD — a coarse heuristic
  (mirrors the root app); Razorpay still bills correctly.
- **NOTE-6 — Enterprise `maxFileMB` 500 is aspirational** for in-browser
  parsing; Enterprise is contact-only and BUSINESS.md roadmaps WebWorker
  parsing for large files.
- **NOTE-7 — `setup/supabase.sql`** (encrypted cloud-sync table) is present,
  correctly RLS-scoped (owner-only CRUD), stores ciphertext + counts only, and
  is **not yet wired** into the app — a clean future-sync scaffold.

## 5. Positives worth recording
- Chat numbers are computed by a deterministic engine, never invented; cloud AI
  receives only aggregated summaries (`describeDataForAI`), gated by consent +
  plan + non-guest — matches every privacy claim made in the UI and docs.
- Cross-filtering is genuinely wired end-to-end and tested (dashboards →
  WidgetView click → `crossFilter` → `mergedQuery`), not cosmetic.
- No dead buttons, no `TODO`/`FIXME`/"coming soon" markers in source; all
  navigation and action handlers are wired; graceful offline/guest fallbacks
  throughout.
- Docs (SECURITY / BUSINESS / USER_GUIDE) are accurate and unusually honest
  about limitations; the owner-facing guide is genuinely non-technical.

## 6. Verdict

Zero BLOCKERs. All three verification gates green (typecheck 0 errors,
67/67 tests, build 896.16 kB). Root Kithra app provably untouched. One MAJOR
(scenarios copy vs. implementation) and three MINORs are copy/hardening items,
not launch stoppers; MAJOR-1 should be fixed promptly as it concerns paid-tier
honesty.

### APPROVED FOR PRODUCTION

---

## Remediation (post-review, same session)

- **MAJOR (plan copy vs reality)** — fixed: forecasts are now gated behind the
  Premium entitlement in the chat flow (with a clear upgrade message that
  burns no usage), the forecast suggestion chip hides on non-Premium plans,
  and all plan copy now says "Forecasts & trend projections"; what-if
  scenario modelling moved to the roadmap in BUSINESS.md. Regression test added.
- **MINOR 1 (unenforced limits)** — fixed: `maxRowsPerTable` is enforced at
  ingest (tables truncated to the plan cap with a warning) and
  `maxWorkspaces` at save time (new workspaces beyond the cap are not
  persisted, with an upsell toast).
- **MINOR 2 (act() warnings)** — accepted as test-console noise; tracked.
- **MINOR 3 (CORS mirrors)** — accepted, documented in SECURITY.md and the
  in-app failure guidance ("export the data as a file instead").
