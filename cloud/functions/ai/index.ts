// ============================================================
// Kithra — Supabase Edge Function: AI via Google Gemma (free)
// Keeps GOOGLE_AI_API_KEY server-side. The client calls this,
// never Google directly.
//
// Deploy:
//   supabase functions deploy ai
//   supabase secrets set GOOGLE_AI_API_KEY=<your key from aistudio.google.com>
//   # optional: supabase secrets set GEMMA_MODEL=gemma-3-27b-it
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const KEY = Deno.env.get("GOOGLE_AI_API_KEY") || "";
const MODEL = Deno.env.get("GEMMA_MODEL") || "gemma-3-27b-it";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (!KEY) return json({ error: "GOOGLE_AI_API_KEY is not set on the server" }, 500);

  try {
    const { prompt, system } = await req.json();
    const text = (system ? system + "\n\n" : "") + (prompt || "");
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 512 },
      }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || "Gemma request failed" }, 502);
    const out = (data?.candidates?.[0]?.content?.parts || [])
      .map((p: { text?: string }) => p.text || "").join("").trim();
    return json({ text: out, model: MODEL });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
