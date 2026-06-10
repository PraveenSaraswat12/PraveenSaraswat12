// ============================================================
// Kithra — Supabase Edge Function: AI via Google Gemma (free)
// Auto-discovers a Gemma model, disables "thinking" output for
// clean answers, strips any leftover reasoning. (No template
// literals, so it survives copy/paste anywhere.)
//
// Deploy: Supabase → Edge Functions → "ai" → paste → Deploy
// Secret: GOOGLE_AI_API_KEY = <Google AI Studio key>
// (optional) GEMMA_MODEL = gemma-4-31b-it
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const KEY = Deno.env.get("GOOGLE_AI_API_KEY") || "";
const FORCED = Deno.env.get("GEMMA_MODEL") || "";
const API = "https://generativelanguage.googleapis.com/v1beta";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

let cached = "";
const pickModel = async () => {
  if (cached) return cached;
  if (FORCED) { cached = FORCED; return cached; }
  try {
    const r = await fetch(API + "/models?key=" + KEY);
    const d = await r.json();
    const ok = (d.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m: any) => String(m.name || "").replace("models/", ""));
    const prefs = ["gemma-4-31b-it", "gemma-3-27b-it", "gemma-3-12b-it", "gemma-2-27b-it", "gemma-2-9b-it", "gemma-4-26b-a4b-it", "gemma-3-4b-it"];
    cached = prefs.find((p) => ok.includes(p)) || ok.find((n: string) => n.indexOf("gemma") === 0) || ok.find((n: string) => n.indexOf("gemini") === 0) || "gemma-4-31b-it";
  } catch (e) { cached = "gemma-4-31b-it"; }
  return cached;
};

const clean = (t: string) => {
  if (!t) return t;
  const reasoning = /(^|\n)\s*[*-]\s/.test(t) && /(Constraint|Draft|Persona|Option \d|Self-Correction|Final answer|Final check|Refining)/i.test(t);
  if (reasoning) {
    const paras = t.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    const plain = paras.filter((p) => !/^[*\-]/.test(p) && !/^\s{2,}\S/.test(p) && p.length > 25 && !/Constraint|Draft|Self-Correction|Final check|Refining|Persona|Option \d/i.test(p));
    if (plain.length) return plain[plain.length - 1].replace(/^["'*\s]+|["'*\s]+$/g, "").trim();
  }
  return t.trim();
};

const gen = async (model: string, text: string, noThink: boolean) => {
  const cfg: any = { temperature: 0.6, maxOutputTokens: 1024 };
  if (noThink) cfg.thinkingConfig = { thinkingBudget: 0 };
  const r = await fetch(API + "/models/" + model + ":generateContent?key=" + KEY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text }] }], generationConfig: cfg }) });
  return { r, d: await r.json() };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (!KEY) return json({ error: "GOOGLE_AI_API_KEY is not set on the server" }, 500);
  try {
    const body = await req.json().catch(() => ({} as any));
    if (body.list) { const r = await fetch(API + "/models?key=" + KEY); return json(await r.json()); }
    const model = await pickModel();
    const text = (body.system ? body.system + "\n\n" : "") + (body.prompt || "");
    let res = await gen(model, text, true);
    if (!res.r.ok && /thinking|unknown name|Invalid JSON|not supported|INVALID_ARGUMENT/i.test(JSON.stringify(res.d))) res = await gen(model, text, false);
    if (!res.r.ok) { cached = ""; return json({ error: (res.d?.error?.message) || "Gemma request failed", model }, 502); }
    const parts = res.d?.candidates?.[0]?.content?.parts || [];
    const raw = parts.map((p: { text?: string }) => p.text || "").join("").trim();
    return json({ text: clean(raw), model });
  } catch (e) { return json({ error: String(e) }, 500); }
});
