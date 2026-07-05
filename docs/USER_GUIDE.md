# Kithra Insight — Owner's Guide (no tech knowledge needed)

**Your live app:** https://praveensaraswat12.github.io/PraveenSaraswat12/insight/

## What it does

1. **Upload anything — zero questions asked** — Excel, CSV, PDF, JSON, code
   files, or paste a link. Insight reads 100% of it silently (every sheet,
   row and column), links related files (orders ↔ customers) and saves it
   encrypted. You just see: "Read everything. Saved securely."
2. **Then it asks what YOU need — in plain words** — "What do you want to
   learn?", "What decision should this help?", "Anything custom you track?"
   Tap suggestions or type freely; Insight maps your words to the data by
   itself (columns, dates, aging buckets — even "15/30/45 days" typed in a
   sentence). Column-level tweaking lives in an optional "Refine" screen.
3. **It shows you the plan before building** — the exact KPI cards, charts,
   aging views, tables and filters it proposes, each with a one-line reason.
   Untick anything, then "Build my dashboards". Click any bar or slice and
   **everything re-filters together**; add more filters, custom date ranges,
   and search inside tables anytime.
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
2. **Cloud backup (open workspaces from any device)**: Supabase dashboard →
   SQL editor → paste the contents of `setup/supabase.sql` → Run. Then in
   the app: Settings → Cloud backup → switch it on. Workspaces sync
   encrypted from then on; a "Delete all cloud backups" button is right
   there too.

## If something looks wrong

- A file won't parse → you'll get a clear message per file; others still load.
- A web link fails → that site blocks fetching; download it as CSV/Excel
  and upload instead.
- Wipe everything: Settings → Erase all local data.
