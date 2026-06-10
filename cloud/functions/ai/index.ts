// ============================================================
// Kithra — Supabase Edge Function: AI gateway
//   - text  : Google Gemma (clean answers)
//   - audio : Google Gemini (accurate transcription, multimodal)
// Keeps GOOGLE_AI_API_KEY server-side. No template literals.
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

let MODELS: string[] | null = null;
const listModels = async () => {
  if (MODELS) return MODELS;
  try {
    const r = await fetch(API + "/models?key=" + KEY);
    const d = await r.json();
    MODELS = (d.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m: any) => String(m.name || "").replace("models/", ""));
  } catch (e) { MODELS = []; }
  return MODELS as string[];
};
const pickText = async () => {
  if (FORCED) return FORCED;
  const ok = await listModels();
  const prefs = ["gemma-4-31b-it", "gemma-3-27b-it", "gemma-3-12b-it", "gemma-2-9b-it"];
  return prefs.find((p) => ok.includes(p)) || ok.find((n) => n.indexOf("gemma") === 0) || "gemma-4-31b-it";
};
const pickAudio = async () => {
  const ok = await listModels();
  const prefs = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest", "gemini-2.0-flash-001", "gemini-2.5-flash-lite"];
  return prefs.find((p) => ok.includes(p)) || ok.find((n) => n.indexOf("gemini") === 0 && n.indexOf("flash") >= 0) || "gemini-2.0-flash";
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
const call = async (model: string, parts: any[], maxTokens: number, noThink: boolean) => {
  const cfg: any = { temperature: 0.2, maxOutputTokens: maxTokens };
  if (noThink) cfg.thinkingConfig = { thinkingBudget: 0 };
  const r = await fetch(API + "/models/" + model + ":generateContent?key=" + KEY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: cfg }) });
  return { r, d: await r.json() };
};
const textOf = (d: any) => (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (!KEY) return json({ error: "GOOGLE_AI_API_KEY is not set on the server" }, 500);
  try {
    const body = await req.json().catch(() => ({} as any));
    if (body.list) { const r = await fetch(API + "/models?key=" + KEY); return json(await r.json()); }

    // ---- transcription (audio -> text) via Gemini multimodal ----
    if (body.audio) {
      const model = await pickAudio();
      let instr = "Transcribe this audio recording verbatim. Output ONLY the exact words spoken, with natural punctuation and capitalization. Do not translate, summarize, add timestamps, or add commentary.";
      if (body.language && body.language !== "auto") instr += " The audio is spoken in " + body.language + ".";
      if (body.context) instr += " Spell these names and terms correctly if they occur: " + body.context + ".";
      const parts = [{ text: instr }, { inlineData: { mimeType: body.mimeType || "audio/wav", data: body.audio } }];
      let res = await call(model, parts, 2048, true);
      if (!res.r.ok && /thinking|unknown name|INVALID_ARGUMENT/i.test(JSON.stringify(res.d))) res = await call(model, parts, 2048, false);
      if (!res.r.ok) return json({ error: res.d?.error?.message || "Transcription failed", model }, 502);
      return json({ text: textOf(res.d), model, engine: "gemini" });
    }

    // ---- text generation via Gemma ----
    const model = await pickText();
    const text = (body.system ? body.system + "\n\n" : "") + (body.prompt || "");
    let res = await call(model, [{ text }], 1024, true);
    if (!res.r.ok && /thinking|unknown name|INVALID_ARGUMENT/i.test(JSON.stringify(res.d))) res = await call(model, [{ text }], 1024, false);
    if (!res.r.ok) return json({ error: res.d?.error?.message || "Gemma request failed", model }, 502);
    return json({ text: clean(textOf(res.d)), model, engine: "gemma" });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
