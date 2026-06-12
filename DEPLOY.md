# Kithra — Go-Live Runbook

Everything in the app is built and wired. This is the checklist to make it
**actually run** against your own Supabase + Razorpay + Google accounts. None of
these steps need code changes — they're configuration you do once.

Project: `https://elaruyvaroadjlhsddxb.supabase.co`

---

## Step 1 — Database (2 min)

Supabase dashboard → **SQL Editor** → paste the entire contents of
[`cloud/schema.sql`](cloud/schema.sql) → **Run**.

This is **idempotent** (safe to re-run). It creates/ensures:
- `books`, `recordings` (you already have these)
- `consents` — the consent ledger (currently missing → this adds it)
- `subscriptions` — which plan a user paid for (read-only to the client; only the
  payment function can write it)
- the private `audio` storage bucket + row-level-security policies

---

## Step 2 — AI + Payments functions (5 min)

Two Edge Functions live in [`cloud/functions/`](cloud/functions/). **Both files
deliberately use no backtick template literals**, so they survive copy/paste.

### 2a. `ai`  — fixes the slow / wrong AI
The version currently deployed is the old "Gemma" thinking model (it rambled and
was factually wrong). Replace it with [`cloud/functions/ai/index.ts`](cloud/functions/ai/index.ts)
(clean Gemini Flash, `thinkingBudget:0`).

- **Dashboard path:** Edge Functions → `ai` → paste the file → Deploy.
- **CLI path:** `supabase functions deploy ai`
- Secret (you already set this): `GOOGLE_AI_API_KEY` = your Google AI Studio key.

### 2b. `payments` — Razorpay checkout (new)
Deploy [`cloud/functions/payments/index.ts`](cloud/functions/payments/index.ts).

- **Dashboard:** Edge Functions → Create function `payments` → paste → Deploy.
- **CLI:** `supabase functions deploy payments`
- Secrets to add (Edge Functions → Secrets):
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

> The price table lives **server-side** in `payments/index.ts` so the amount can't
> be tampered with from the browser: Plus = $30 / ₹2,499 per month, Premium =
> $90 / ₹7,499 per month, annual = 10× monthly (two months free).

---

## Step 3 — Sign-in methods (Auth → Providers)

The app offers three real ways to sign in. Each needs its provider switched on:

| Method | What to do | Cost |
|---|---|---|
| **Email + password** | Already on by default. Nothing to do. | Free |
| **Google** | Auth → Providers → **Google** → on. In Google Cloud Console create an OAuth client, set the **Authorized redirect URI** to `https://elaruyvaroadjlhsddxb.supabase.co/auth/v1/callback`, paste the Client ID + Secret into Supabase. Then Auth → URL Configuration → add your site URL (the GitHub Pages URL) to **Redirect URLs**. | Free |
| **Phone + OTP** | Auth → Providers → **Phone** → on, then connect an SMS provider (e.g. **Twilio**). | Twilio is **paid** (~$0.01–0.08 per SMS). Until it's connected, the Phone tab will show Supabase's "SMS provider not configured" error — that's expected. |

> The Google redirect returns into the app's URL; Supabase reads the session out
> of it automatically and the login gate clears on focus. No code change needed.

---

## Step 4 — Razorpay (payments)

1. Create a Razorpay account → **Settings → API Keys** → generate keys.
   - Use **Test mode** keys first (`rzp_test_…`) to try it with test cards, then
     switch to **Live** keys (`rzp_live_…`).
2. Put `key_id` / `key_secret` into the Supabase secrets in Step 2b.
3. **INR works out of the box.** Charging in **USD** requires enabling
   International payments on your Razorpay account (KYC). The app lets the user
   pick ₹ INR or $ USD; INR is the safe default for India.
4. Card details never touch our servers — Razorpay Checkout collects them and we
   only verify the signed result.

Razorpay test card: `4111 1111 1111 1111`, any future expiry, any CVV.

---

## Step 5 — Smoke test (after Steps 1–4)

1. **Sign in** three ways: email, Google, phone OTP (if Twilio is on).
2. **Record or upload** audio → it transcribes (Gemini) → you get an insight card.
3. **Ask Kithra** a question about your recording → grounded, concise answer
   (no "thinking out loud", no wrong facts).
4. **Plans** → Upgrade to Plus → Razorpay opens → pay with the test card → the
   plan unlocks and shows as "Current plan".
5. **Sign out and back in** → the paid plan persists (read from `subscriptions`).

---

## What costs money (be aware)

| Thing | Cost |
|---|---|
| Google Gemini (AI + transcription) | Generous **free tier**; paid only above it |
| Supabase (DB/Auth/Functions) | Free tier is plenty to start |
| Twilio SMS (phone OTP) | **Paid** per message — only if you enable Phone login |
| Razorpay fees | ~**2–3%** per successful payment |

Everything else (hosting on GitHub Pages, the app itself) is free.
