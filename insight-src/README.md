# Kithra Insight — source

Client-side data-analysis studio. See `AGENTS.md` for the architecture
charter, `../docs/` for security/business/user docs.

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # strict TS
npm test           # vitest (engine, security, billing, full-app integration)
npm run build      # emits ../public/insight/index.html (single self-contained file)
```

Deploy = rebuild, commit, and merge to `main` — the "Deploy Kithra to
GitHub Pages" workflow publishes the site (including `public/insight/`)
automatically on every push to main.

## Layout

- `src/contracts/` — shared types + module interfaces (the law)
- `src/engine/` — parsing (xlsx/csv/pdf/json/code/web), profiling,
  relations, query core, wizard, dashboard design, insights, NL analyst
- `src/security/` — auth (Supabase Google/OTP + guest), AES-GCM vault,
  IndexedDB store, backups, consent, erase
- `src/billing/` — plans, entitlements, usage caps, Razorpay checkout
- `src/platform/` — Kithra cloud client (Supabase + payments edge functions)
- `src/ui/`, `src/pages/` — design system, stores, Chart.js renderer, pages
