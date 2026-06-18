# Kithra — Feature Verification & Test Plan

**App:** Kithra — "Where talk becomes insight" (React + Vite + Supabase + Gemini)
**Reviewed:** 2026-06-12 by the Features/QA agent
**Build under test:** `dist-single/index.html` (single-file bundle, served at `http://127.0.0.1:8066/index.html`)
**Automated suite:** `tests/e2e.mjs` (Playwright/chromium) — **43 assertions, all passing (exit 0).**

---

## How to run the suite

```bash
# 1) Serve the EXISTING build (do NOT rebuild — the build agent owns that):
/opt/node22/bin/node /opt/node22/lib/node_modules/http-server/bin/http-server \
  /home/user/PraveenSaraswat12/dist-single -p 8066 -s &

# 2) Run the e2e suite:
/opt/node22/bin/node /home/user/PraveenSaraswat12/tests/e2e.mjs
# exit 0 = all passed, 1 = a failure, 2 = suite crashed (e.g. server down)
```

The suite passes the login gate by stubbing `window.KithraCloud.getUser` and firing a `focus`
event (the same session re-check the app uses when returning from the Google OAuth redirect),
then drives the UI by route hash. Server-only paths (a real Razorpay charge, live Google
auth, the Gemini Edge Function) require backend secrets and are **not** exercised live — they are
verified by reading the client/server contract and are marked **NEEDS-BACKEND** below.

---

## Result matrix

| # | Feature | Result | Evidence / repro |
|---|---------|--------|------------------|
| 1 | **Auth gate** — app routes require login; `#auth` shows Google + Email; sign-out → `KithraCloud.signOut` | **PASS** | `app.jsx:212` `needLogin = isApp && cloudConfigured && user===null`; built bundle bakes in `KITHRA_CONFIG` (real Supabase URL+key) so `configured()===true` → gate is **live**. Logged-out `#dashboard` renders `<Auth gate>`; app shell (`.app`/`.side`) is absent from the DOM. Sign-out in `app.jsx:380` calls `KithraCloud.signOut()`. Suite §1. |
| 2 | **Auth method wiring** (`cloud.js`) | **PASS** (client) / **NEEDS-BACKEND** (live Google) | `signInWithGoogle`→`signInWithOAuth({provider:'google',…})`; email `signUp`/`signIn`→`signUp`/`signInWithPassword`. All client calls correct. Live Google needs Supabase provider config. Suite §2. |
| 3 | **Recording → transcription → insight** | **PASS** (with 1 fix applied) | Upload/record → `addClip()` (`screens-analyze.jsx:165`). Transcribe → `KithraCloud.transcribe(b64,{mimeType,language,context})` (`:424`) → on success `updateClip(clipId,{transcript})` (`:418`). Insight → `KithraAI.clipInsights(clip,mode)` (`screens-conversation.jsx:26`) → `updateClip(clip.id,{insights})` (`:27`). AI shapes match `cloud/functions/ai/index.ts` (`{prompt,system}` for text, `{audio,mimeType,language,context}` for transcription). **Bug found & fixed:** insights weren't persisted (see Fixes). Suite §9. |
| 4 | **Ask Kithra** — grounded answers + consent gate | **PASS** | `askKithra()` (`ai.js:57`) builds context from real `clips`/`books`/`focus` (`buildContext` `:29`), persona forbids inventing data (`:50-54`). First send with no `cloud_ai` consent shows the consent card and blocks the AI call (`screens-ask.jsx:49`, `:171-179`); `allowAndSend` grants then sends. Toolbar shows live "N recordings · M transcribed · K books". Suite §7. |
| 5 | **Patterns from real data; no mock data anywhere user-visible** | **PASS** | `screens-patterns.jsx` derives all series from `clips`/`analysis` (`:12-18`); AI read calls `askKithra` over real clips. **No mock data is displayed:** `window.LUMEN`/`data.js` still loads, but the `data` context value (`app.jsx:181/184`) is **never destructured by any screen**. `window.LUMEN` is only used for onboarding goal chips, a capture-mode AI fallback string, and `importQueue` init (not rendered). Dashboard/Conversation/Library/Patterns/Ask all read real `clips`/`books`. |
| 6 | **Pricing / payments** | **PASS** (math + client/server contract) / **NEEDS-BACKEND** (live charge) | Headline math verified **in the running app**: Plus $30 / ₹2,499, Premium $90 / ₹7,499; annual = 10× (Plus $25/mo billed $300/yr; Premium $75/mo billed $900/yr); currency + period toggles work. **Field names match end-to-end:** client `createOrder(plan,period,currency)`→`{action:'order',plan,period,currency}` (`cloud.js:229`); server reads `body.plan/period/currency`, prices in smallest unit (`payments/index.ts:21-24`), returns `{order_id,amount,currency,key_id}`; client opens Razorpay with those, then `verifyPayment({razorpay_order_id,razorpay_payment_id,razorpay_signature,plan})` → server HMAC-verifies + upserts `subscriptions` (`:65-79`). `getSubscription()` reflects the server plan on load (`screens-pricing.jsx:40-46`). Suite §5. |
| 7 | **Plan gating** — Patterns locked below Plus; PlanPill routes paid tiers to checkout | **PASS** (with 1 fix applied) | **Bug found & fixed:** the screen itself wasn't gated (only a nav lock pill), so any entry path (hash, search, `go`) reached Patterns content on Free. Added a component-level `planAllows('plus')` wall (`screens-patterns.jsx`). Verified live: Free user at `#patterns` sees the upgrade wall, **not** the charts/AI read. PlanPill → Premium navigates to `#pricing` and does **not** set plan to paid (`app.jsx:443-449`). Books mirror this: summaries gated to Plus, in-app reading to Premium (`screens-books.jsx:76,148`). Suite §6. |
| 8 | **Privacy / data rights** | **PASS** | Consent ledger (grant/withdraw with timestamp + version) in `ConsentDataPanel` → `grantConsent/withdrawConsent` (`app.jsx:123-124`) → `KithraCloud.syncConsents` (`cloud.js:130`). Export → JSON download of consents/books/recordings (`screens-privacy.jsx:107-118`). Delete-all → `KithraCloud.deleteAllCloud()` + localStorage wipe + reload (`:119-126`, `cloud.js:167`). Redaction toggle masks PII before display/storage/AI. Suite §8. |

**Tally: 8/8 features PASS** (2 with a fix applied this pass; items 2 & 6 additionally carry NEEDS-BACKEND for the live third-party paths that require Supabase secrets, which is expected and out of the client's control).

---

## Bugs found & fixed (in scope: `src/*.js(x)` + `cloud/`)

### Fix 1 — Patterns was not plan-gated at the screen level (Feature 7)
**Symptom:** The sidebar showed a "Plus" lock pill, but `go('patterns')`, `location.hash='#patterns'`,
the top-bar search→Ask deep-link, and any other navigation still rendered the full Patterns screen
(trend charts + AI "pattern read") for **Free** users. The lock was cosmetic.
**Fix:** Added a `planAllows('plus')` guard at the top of the `Patterns` component that returns an
upgrade wall (with an "Upgrade to Plus" CTA → `#pricing`) for sub-Plus plans, so no entry path leaks
the content. — `src/screens-patterns.jsx`
**Verified:** Suite §6 — Free user at `#patterns` now sees the wall, not the charts (passing against
the rebuilt `dist-single`).

### Fix 2 — AI insights were generated but never persisted (Feature 3)
**Symptom:** `clipInsights` results were stored on the in-memory clip via `updateClip(id,{insights})`,
but `Cloud.saveRecording` only wrote `analysis` + `transcript`, the `recordings` table had no
`insights` column, and `fetchRecordings` never restored it. So an insight card survived in-session
but was **lost on reload / re-login**, even though the transcript persisted and the Privacy UI claims
insights are stored/deletable. A real cross-session-memory gap.
**Fix (3 surgical edits):**
- `src/cloud.js` `saveRecording` — encrypt + write `insights` (JSON, AES-GCM on-device, same as transcripts).
- `src/cloud.js` `fetchRecordings` — decrypt + `JSON.parse` `insights` back onto the clip.
- `cloud/schema.sql` — add `insights text` to `public.recordings` **plus** an idempotent
  `alter table … add column if not exists insights text` so existing projects back-fill the column.
**Note:** the running `dist-single` could not assert restore-on-reload (that round-trips a live
Supabase row), so the suite verifies the client functions exist and the math/flow; the persistence
fix is verified by code + clean transform/`node --check`. The orchestrator's re-test against a real
Supabase project will exercise the round-trip.

Both edited files pass `node --check` / esbuild JSX transform. **`src/main.jsx` and `src/styles/**` were
not touched.**

---

## Observations (not bugs — for the record)

- **Auth gate is conditional on `cloudConfigured`.** If a build ever shipped **without** `KITHRA_CONFIG`,
  `needLogin` would be false and the app would render with no login (the "offline escape" the spec warns
  against). The shipped `dist-single` **does** bake in a real Supabase config, so the gate is enforced in
  production. Recommend keeping config baked in (or hard-failing the build if it's absent) so the gate can
  never silently disable.
- **Consent UX differs by surface (acceptable).** Ask shows an explicit "Allow Kithra to send context to
  the AI?" card before the first call. The Conversation deep-dive's "Generate insights" button treats the
  explicit click as consent and auto-records it in the ledger (`screens-conversation.jsx:21-23`) rather than
  showing a second dialog. Both record consent in the ledger; the Ask flow is the stricter, gated one. Fine
  as-is, but worth aligning if a uniform pre-AI dialog is desired.
- **`window.LUMEN` / `src/data.js` is dead-ish weight.** It's loaded and assigned but not displayed
  anywhere. Safe to leave; could be deleted later to shrink the bundle and remove any future footgun.

---

## Verdict — is this a real, shippable success?

**Yes — this is a real, shippable success**, with the two fixes above applied (and assuming the standard
backend setup: Supabase Auth providers for live Google, the Razorpay + Google-AI Edge Function secrets,
and `cloud/schema.sql` run on the project).

The product is genuinely wired end-to-end, not a mock: a real login gate (no offline escape in the shipped
build), correct client calls for all three auth methods, a real recording→transcription→insight pipeline
with correct AI request shapes, AI features grounded strictly in the user's real clips/books with a consent
gate, **no mock data surfacing in any user-facing screen**, correct pricing math with matching client/server
field names and server-side price-table + signature verification, working plan gating (after Fix 1), and a
real consent ledger + export + erasure. The 43-assertion Playwright suite passes against the live build.

**Pre-redeploy checklist for the orchestrator:**
1. Re-bundle `src/` so Fixes 1 & 2 land in `dist-single` (the build agent's rebuild already picked up Fix 1 — confirmed by the passing gate test; confirm Fix 2 is bundled too).
2. Run `cloud/schema.sql` on the Supabase project (adds the `insights` column).
3. Confirm Supabase secrets are set: Google provider, `GOOGLE_AI_API_KEY`, `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`.
4. Smoke-test one live Razorpay test-mode order and one Gemini call end-to-end (the only paths the UI suite can't charge).
