# Kithra Insight — Security & Data Protection

_Last reviewed: 2026-06-13_

## Architecture in one paragraph

Kithra Insight is a **client-side** application served as a single static file
from GitHub Pages. Parsing (Excel/CSV/PDF/JSON/code/web), profiling, relation
detection, every analytics query, dashboard rendering and the local AI analyst
all run **inside the user's browser**. There is no application server that
receives or stores user datasets.

## What is stored, where, and how

| Data | Location | Protection |
|---|---|---|
| Workspaces (tables, dashboards, chat) | Browser IndexedDB | **AES-256-GCM** encrypted payloads; random 256-bit device key (`localStorage`), fresh 96-bit IV per write |
| Workspace names + row counts | IndexedDB record metadata | Plain (needed for listing without decryption); contains no row data |
| Portable backups (`.kithra` files) | Wherever the user saves them | **PBKDF2** (250,000 iterations, SHA-256) key from the user's passphrase → AES-256-GCM |
| Session tokens | localStorage (supabase-js default) | Standard Supabase JWT session, shared across Kithra apps on this origin |
| Plan/usage counters, consent flag | localStorage | Non-sensitive |

The GCM authentication tag means any tampering with stored ciphertext is
detected at decrypt time and surfaced as an error rather than silently
producing corrupt data.

## What can ever leave the device

1. **Authentication** — Google OAuth / phone OTP handled by Supabase
   (`elaruyvaroadjlhsddxb.supabase.co`). Row-level security is enforced
   server-side; the anon API key embedded in the app is public **by design**
   and grants nothing without a user session.
2. **Cloud AI (opt-in, paid plans)** — only compact numeric summaries
   produced by `engine.describeDataForAI`: table names, column names/types,
   min/max/totals, top category values, and a few computed aggregates.
   **Raw rows are never transmitted.** Requires BOTH the consent toggle in
   Settings (default **off**) AND a plan with cloud AI.
3. **Payments** — Razorpay's hosted checkout (PCI-DSS). Card/UPI details
   never pass through Insight's code; the app only receives the payment id
   and signature for server-side verification.
4. **Web import** — when the user pastes a URL, the browser fetches it
   (optionally via public CORS mirrors `corsproxy.io` / `allorigins.win`
   when the site blocks direct browser access). Users should only import
   public links; this is stated in the UI guidance.

## Transport

Everything is served and fetched over HTTPS (GitHub Pages, Supabase,
Razorpay, jsDelivr CDN for supabase-js/pdf.js).

## Data rights

- **Export** — encrypted, passphrase-protected backup of any workspace.
- **Erase** — Settings → "Erase all local data" deletes the IndexedDB
  database and every Insight key, then signs out. (Note: because the session
  is shared, this also signs the device out of the root Kithra app — stated
  in the confirmation dialog.) The root Kithra app's own stored data is
  deliberately left untouched.
- **Account deletion** — by email; removed within 7 days.

## No tracking

No analytics, no ad pixels, no fingerprinting, no third-party trackers.

## Cloud backup of workspaces (optional, off by default)

When the owner has run `setup/supabase.sql` and the user switches on
**Settings → Cloud backup**, workspaces are also stored in the
`insight_workspaces` table so they can be opened from any signed-in device.

- Payloads are sealed **on the device** with AES-256-GCM before upload; the
  database stores ciphertext plus only a name and row counts for listing.
- The encryption key is derived from the user's account id (PBKDF2). This is
  **at-rest protection tied to the account, not zero-knowledge** — stated in
  the app UI. A user-passphrase mode (true zero-knowledge) is on the roadmap.
- Row-level security restricts every row to its owner.
- "Delete all cloud backups" in Settings removes every cloud copy; deleting
  a workspace in the app removes its cloud copy too.

## Honest limitations & roadmap

- Device-at-rest encryption cannot protect against malware running on the
  same device or someone using an unlocked browser profile. Recommend device
  lock + passphrase backups.
- The device key lives in `localStorage` (required for a no-password local
  experience). A passphrase-wrapped key option is on the roadmap.
- Browser storage can be evicted by the OS under extreme disk pressure —
  users are encouraged to export backups of important workspaces
  (`navigator.storage.persist` request is a planned hardening).
- Optional **encrypted cloud sync** is prepared but not enabled: run
  [`setup/supabase.sql`](../setup/supabase.sql) in the Supabase SQL editor to
  create the RLS-protected table; payloads remain client-side encrypted.

## Reporting

Email **smyttenorders@smytten.com** — response within 48 hours.
