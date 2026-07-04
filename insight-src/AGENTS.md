# Kithra Insight — build charter

Product: **Kithra Insight — "Where data becomes decisions."**
A fully client-side data-analysis studio. Users upload Excel / CSV / PDF /
JSON / code files or paste a web link → the app reads and profiles
everything, detects relations between tables, asks clarifying questions
(goal, aging date column, filters, KPIs) → generates connected interactive
dashboards (cross-filtering, aging buckets, %, trends) → a chat analyst
answers any question about the data with charts/tables, grounded in real
computed numbers. Login (Google / phone OTP via Kithra's Supabase), plans
Free / Pro / Premium / Enterprise with Razorpay checkout. All analysis
happens in the browser; storage is encrypted IndexedDB; optional cloud AI
goes through Kithra's existing `/functions/v1/ai` edge function with
explicit consent.

Deploy model: `npm run build` emits ONE self-contained file
`../insight/index.html`, served by GitHub Pages from this branch at
`https://praveensaraswat12.github.io/PraveenSaraswat12/insight/`.
The root Kithra app (`/index.html`, `/books/`) must NEVER be touched.

## File ownership (strict — never edit another agent's area)

| Area | Owner |
|---|---|
| `src/contracts/**`, `src/platform/**`, configs, `index.html`, `src/main.tsx`, `src/test/setup.ts` | Architect (read-only for agents) |
| `src/engine/**` | Agent 1 — Core Logic |
| `src/App.tsx`, `src/ui/**`, `src/pages/**`, `src/styles/**` (may append below the token block) | Agent 2 — Design & Experience |
| `src/security/**` | Agent 3 — Security & Data Cloud |
| `src/billing/**` | Agent 4 — Business |
| `src/**/*.test.{ts,tsx}`, `qa/**`, test fixtures | Agent 5 — QA |
| `../docs/**` | Agent that owns the topic; Supervisor writes REVIEW.md |

## Integration rules

1. Modules expose exactly the interfaces in `src/contracts/modules.ts`:
   `engine` (InsightEngine), `security` (SecurityModule), `billing`
   (BillingModule). UI imports only those three entry points + contracts +
   platform helpers.
2. No new npm dependencies — package.json is frozen. Heavy/optional libs
   (supabase-js, pdf.js, Razorpay) load from CDN at runtime; pdf.js must go
   through `src/engine/io/cdn.ts` so tests can mock it with the local
   `pdfjs-dist` devDependency.
3. Engine code is pure TypeScript: no React, no zustand, no IndexedDB.
   DOM use allowed only for parsing (DOMParser, FileReader).
4. Everything must work signed-out and offline (local engine, guest mode,
   local storage). Cloud (auth, AI, payments) is an enhancement, never a
   requirement; every cloud call needs a graceful fallback.
5. No raw row data ever leaves the device. Cloud AI receives only compact
   aggregated summaries from `engine.describeDataForAI`, and only when the
   user has granted cloud consent AND their plan allows it.
6. TypeScript strict; `npm run typecheck`, `npm run test`, `npm run build`
   must stay green.
