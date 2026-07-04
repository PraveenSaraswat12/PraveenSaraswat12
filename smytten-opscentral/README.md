# Smytten OpsCentral

Internal ops intelligence for Smytten — **Phase 1: Delhivery Courier Intelligence**.
Upload Delhivery MIS exports and get role-based dashboards for last-mile
performance (P-to-D, RTO, NDR, TAT), leadership RAG status, vendor SLA reports,
finance COD exposure, and an email-intelligence layer for chargebacks &
escalations.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **PostgreSQL** + **Prisma 7** (driver-adapter client via `@prisma/adapter-pg`)
- **NextAuth.js** (credentials, JWT sessions, role-based middleware)
- **Recharts** charts · **Papaparse** + **SheetJS** CSV/Excel parsing
- shadcn-style UI components · brand purple `#6C3FD1`

## Quick start

```bash
# 1. Postgres — create a database and user, then set DATABASE_URL
cp .env.example .env            # fill in DATABASE_URL + NEXTAUTH_SECRET

# 2. Install + generate the Prisma client
npm install                     # postinstall runs `prisma generate`

# 3. Apply schema + seed demo users and synthetic data
npm run db:migrate
npm run db:seed

# 4. Run
npm run dev                     # http://localhost:3000
```

### Demo accounts (password `Smytten@123`)

| Role | Email | Lands on |
| --- | --- | --- |
| Ops Execution | `exec@smytten.com` | Courier Intelligence |
| Ops Leadership | `lead@smytten.com` | Leadership (RAG) |
| Finance | `finance@smytten.com` | Finance (COD) |
| Vendor | `vendor@smytten.com` | Vendor SLA report |

## Phase-1 status

- [x] Auth + 4 roles (OPS_EXEC, OPS_LEAD, FINANCE, VENDOR), middleware-gated
- [x] CSV/Excel upload → parse → store, with upload history
- [x] Courier Intelligence dashboard (P-to-D, RTO, NDR, TAT, worst pincodes, 30-day trends)
- [x] Leadership view (RAG vs targets + weekly summary)
- [x] Vendor SLA report (printable / Save-as-PDF)
- [x] Finance COD view (exposure, collection, RTO value-at-risk)
- [~] Email intelligence (rules + UI scaffold; Gmail OAuth + Claude parsing are credential-gated — see below)

## Delhivery CSV column mapping

The parser auto-maps the MIS header row to canonical fields using a synonym
list, so it tolerates header variations. To pin exact Delhivery column names,
add them to `DELHIVERY_HEADER_OVERRIDES` in
[`src/lib/csv/mapping.ts`](src/lib/csv/mapping.ts):

```ts
export const DELHIVERY_HEADER_OVERRIDES = {
  waybill: "awb",          // normalised header -> canonical field
  deliverydate: "deliveryDate",
};
```

After importing a file, the Uploads page shows exactly which columns mapped to
which fields, plus any unmapped headers — use that to confirm/adjust the map.

Canonical fields: `awb, orderDate, pickupDate, deliveryDate, status, rtoFlag,
ndrAttempts, pincode, state, zone, weight, codAmount`.

## Metric definitions

- **P-to-D %** = delivered ÷ picked (picked = has a pickup date or a post-pickup status)
- **RTO %** = RTO shipments ÷ picked
- **NDR** = average delivery attempts per picked shipment
- **TAT** = pickup → delivery days; **breach** = TAT > 5-day SLA
- **RAG** (leadership): P-to-D ≥ 85% · RTO ≤ 12% · NDR ≤ 1.5 avg — *amber* within
  5% of target, *red* beyond (see `src/lib/metrics/thresholds.ts`)

## Email intelligence (item 6)

Rules and review-queue UI are in place. To activate scanning, set in `.env`:

- `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`, default `claude-sonnet-4-6`) — Claude parses matched emails into structured records
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Gmail OAuth
- `CRON_SECRET` — guards the scheduled inbox-scan endpoint

Keyword rules (sender + keywords per category) live in
[`src/lib/email/rules.ts`](src/lib/email/rules.ts); fill `BRAND_LIST` for the
INWARD category.

## Notes on Prisma 7

This project uses Prisma 7's `prisma-client` generator (TypeScript output to
`src/generated/prisma`, gitignored). The runtime client is constructed with a
driver adapter (`src/lib/prisma.ts`); the CLI reads `DATABASE_URL` via
`prisma.config.ts`. Run `npm run db:generate` after pulling schema changes.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev / build / serve |
| `npm run db:migrate` | Create + apply a migration |
| `npm run db:seed` | Seed demo users + synthetic data |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run db:studio` | Prisma Studio |
