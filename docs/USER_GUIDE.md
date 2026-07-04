# Kithra Insight — Owner's Guide (no tech knowledge needed)

**Your live app:** https://praveensaraswat12.github.io/PraveenSaraswat12/insight/

## What it does

1. **Upload anything** — Excel, CSV, PDF, JSON, code files, or paste a link
   to a web page with tables. Multiple files at once is fine; if files are
   related (e.g. orders + customers), Insight finds the connection itself.
2. **It asks you questions** — your goal, which date drives aging, which
   filters and KPIs matter. Every question explains *why* it's asking.
3. **Dashboards build themselves** — KPI cards, monthly trends, breakdowns,
   share donuts, aging buckets (30/60/90 etc.), detail tables. Click any bar
   or slice and **everything re-filters together**.
4. **Chat with your data** — "Total revenue by region", "Top 10 customers",
   "Aging of outstanding payments", "West vs North", "Forecast next 3
   months" (a Premium tool), "Describe my data". Every number is genuinely
   computed from your rows. Pin any answer's chart to a dashboard with the
   pin button.
5. **Insights tab** — automatic findings: trends, concentration risks
   ("one customer is 53% of revenue"), overdue aging, data-quality issues.

## Accounts & plans

- **Guest mode** — everything works, stays 100% on the device.
- **Google / phone sign-in** — same login as your main Kithra app; one
  account across both products.
- **Plans** — Free / Pro $30 / Premium $90 / Enterprise (contact). Checkout
  via Razorpay (UPI, cards, netbanking, wallets). India pays in INR.
- Daily AI-question limits per plan are shown under the chat box.

## Privacy in one line

Files are analysed **in the browser** and stored **encrypted on the
device**; the optional cloud AI sees only number summaries — and only if you
switch consent ON in Settings.

## Day-to-day tips

- **Workspaces** save automatically — find them in the Workspaces tab.
- **Backups**: Settings → Export gives you an encrypted `.kithra` file
  (needs Pro). Keep these for the long run or to move devices.
- Add more files anytime — dashboards refresh and stay connected.
- "Refine" on the dashboards tab re-runs the questionnaire.

## Updating the app (for you, the owner)

The website deploys automatically whenever changes land on the `main`
branch (a GitHub workflow builds and publishes it — Insight ships inside
`public/insight/`). The full source code lives in `insight-src/` — any
future Claude Code session can keep building from it:

```
cd insight-src
npm install        # once
npm run dev        # local preview
npm test           # 68 automated tests
npm run build      # produces public/insight/index.html → merge to main = live
```

## Two optional one-time setups (5 minutes, only if you want them)

1. **Google sign-in returning straight to Insight**: Supabase dashboard →
   Authentication → URL Configuration → add
   `https://praveensaraswat12.github.io/PraveenSaraswat12/insight/` to
   Redirect URLs. (Without it, Google sign-in returns to the root Kithra
   page — you're still signed in to Insight when you go back.)
2. **Future cloud sync**: Supabase dashboard → SQL editor → paste
   `setup/supabase.sql` → Run. Harmless now, enables encrypted sync later.

## If something looks wrong

- A file won't parse → you'll get a clear message per file; others still load.
- A web link fails → that site blocks fetching; download it as CSV/Excel
  and upload instead.
- Wipe everything: Settings → Erase all local data.
