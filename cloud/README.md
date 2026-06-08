# Kithra cloud backend — Supabase + Gemma (all free tiers)

This turns Kithra from a local-first demo into a real product with **accounts**,
**a database that persists**, **cloud storage**, and **server-side AI (Google
Gemma)**. The app works without any of this — connecting the cloud just unlocks
sign-in, sync, and Gemma. **Nothing here costs money on the free tiers.**

Two accounts are needed (only you can create them — they need email/phone
verification):

## 1) Supabase (accounts + database + storage) — ~5 min
1. Go to **supabase.com** → sign up (free) → **New project**. Pick any name + a
   database password. Wait ~2 min for it to provision.
2. **Project Settings → API**: copy your **Project URL** and the **anon public**
   key. (The anon key is safe to use in the app; row-level security protects data.)
3. **SQL Editor → New query** → paste all of [`schema.sql`](./schema.sql) → **Run**.

## 2) Google AI Studio (Gemma key — free) — ~2 min
1. Go to **aistudio.google.com** → **Get API key** → create one. (Free tier.)
2. Keep it secret — it never goes in the app; it lives in the Edge Function below.

## 3) Deploy the AI Edge Function (keeps the key server-side)
Install the Supabase CLI (`npm i -g supabase`), then from this `cloud/` folder:
```bash
supabase login
supabase link --project-ref <your-project-ref>     # ref is in your project URL
supabase functions deploy ai
supabase secrets set GOOGLE_AI_API_KEY=<your-google-key>
# optional, to pick a Gemma model:
supabase secrets set GEMMA_MODEL=gemma-3-27b-it
```

## 4) Connect it in the app
Open Kithra → **Privacy & Data → Cloud & account** → paste your **Project URL**
and **anon key** → **Connect** → **Sign up**. Your books (and, with the function
deployed, Gemma-powered insights) now sync to your account.

---

### What runs where
- **Books / recordings metadata** → Postgres (`books`, `recordings` tables, RLS = each user sees only their own).
- **Audio files** → private `audio` storage bucket (per-user folders).
- **AI (Gemma)** → the `ai` Edge Function → Google AI Studio. The app calls the
  function with a bearer token; the Google key never leaves the server.
- **On-device Whisper transcription** keeps working with no backend at all.

If you'd like, share these steps with me and I'll walk you through each click.
