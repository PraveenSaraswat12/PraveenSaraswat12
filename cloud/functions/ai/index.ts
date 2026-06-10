// ============================================================
// Kithra — Supabase Edge Function: AI via Google Gemma (free)
// Keeps GOOGLE_AI_API_KEY server-side. The client calls this,
// never Google directly. Auto-discovers a working Gemma model so
// you never have to hardcode a model name.
//
// Deploy: Supabase → Edge Functions → function name "ai" → paste → Deploy
// Secret: GOOGLE_AI_API_KEY = <your Google AI Studio key>
// (optional) GEMMA_MODEL = gemma-3-12b-it   ← forces a specific model
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const KEY = Deno.env.get("GOOGLE_AI_API_KEY") || "";
const FORCED = Deno.env.get("GEMMA_MODEL") || "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const API = "https://generativelanguage.googleapis.com/v1beta";

let cached = "";
async function pickModel(): Promise<string> {
  if (cached) return cached;
  if (FORCED) { cached = FORCED; return cached; }
  try {
    const r = await fetch(`${API}/models?key=${KEY}`);
    const d = await r.json();
    const ok = (d.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m: any) => String(m.name || "").replace("models/", ""));
    const prefs = ["gemma-3-27b-it","gemma-3-12b-it","gemma-2-27b-it","gemma-2-9b-it","gemma-3-4b-it","gemma-3-1b-it"];
    cached = prefs.find((p) => ok.includes(p)) || ok.find((n: string) => n.startsWith("gemma")) || ok.find((n: string) => n.startsWith("gemini")) || "gemma-3-4b-it";
  } catch { cached = "gemma-3-4b-it"; }
  return cached;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (!KEY) return json({ error: "GOOGLE_AI_API_KEY is not set on the server" }, 500);
  try {
    const body = await req.json().catch(() => ({}));
    if (body.list) { const r = await fetch(`${API}/models?key=${KEY}`); return json(await r.json()); }
    const model = await pickModel();
    const text = (body.system ? body.system + "\n\n" : "") + (body.prompt || "");
    const r = await fetch(`${API}/models/${model}:generateContent?key=${KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 512 } }),
    });
    const d = await r.json();
    if (!r.ok) { cached = ""; return json({ error: d?.error?.message || "Gemma request failed", model }, 502); }
    const out = (d?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("").trim();
    return json({ text: out, model });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
