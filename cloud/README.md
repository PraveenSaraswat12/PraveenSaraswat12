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

## 2) Groq API key (free) — ~2 min
1. Go to **console.groq.com** → **API Keys** → create one. (Free tier, very fast.)
2. Keep it secret — it never goes in the app; it lives in the Edge Function below.

## 3) Deploy the AI Edge Function (keeps the key server-side)
This function powers both AI answers and **cloud audio transcription** (Groq
Whisper). Install the Supabase CLI (`npm i -g supabase`), then from this `cloud/` folder:
```bash
supabase login
supabase link --project-ref <your-project-ref>     # ref is in your project URL
supabase functions deploy ai
supabase secrets set GROQ_API_KEY=<your-groq-key>
```

## 4) Connect it in the app
Open Kithra → **Privacy & Data → Cloud & account** → paste your **Project URL**
and **anon key** → **Connect** → **Sign up**. Your books (and, with the function
deployed, Gemma-powered insights) now sync to your account.

## 5) "Continue with Google" — one extra URL for the Android app
The web app's redirect works with no extra setup. The **Android app** signs in
through an in-app browser tab that returns via a custom URL scheme instead of
a normal web redirect (Google refuses to run its sign-in screen inside an
embedded WebView) — add this exact URL in **Supabase → Authentication → URL
Configuration → Redirect URLs**, alongside your web app's URL:
```
com.kithra.app://auth-callback
```
Without it, Supabase falls back to your Site URL and Google Sign-In in the
Android app opens the *website* in the system browser instead of returning to
the app.

---

### What runs where
- **Books / recordings metadata** → Postgres (`books`, `recordings` tables, RLS = each user sees only their own).
- **Audio files** → private `audio` storage bucket (per-user folders).
- **AI (Gemma)** → the `ai` Edge Function → Google AI Studio. The app calls the
  function with a bearer token; the Google key never leaves the server.
- **On-device Whisper transcription** keeps working with no backend at all.

If you'd like, share these steps with me and I'll walk you through each click.
