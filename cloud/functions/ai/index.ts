// ============================================================
// Kithra — Supabase Edge Function: AI gateway (multi-provider)
//   Tries GROQ first (fast), then falls back to GOOGLE GEMINI
//   automatically — so one provider going down never takes out
//   AI answers or transcription.
//     text  : Groq chat (Llama 3.3 70B)  -> Gemini generateContent
//     audio : Groq Whisper (large-v3)    -> Gemini multimodal STT
// Secrets (either or both; both already set on this project):
//   GROQ_API_KEY       = console.groq.com key
//   GOOGLE_AI_API_KEY  = aistudio.google.com key
// Optional overrides: GROQ_TEXT_MODEL, GROQ_WHISPER_MODEL, GEMINI_MODEL
// Same request/response contract the web client already uses:
//   { prompt, system, maxTokens }            -> { text, model, engine }
//   { audio(base64), mimeType, language,     -> { text, model, engine }
//     context }
// (No backtick template literals — survives dashboard copy/paste.)
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const GROQ_KEY = Deno.env.get("GROQ_API_KEY") || "";
const GEMINI_KEY = Deno.env.get("GOOGLE_AI_API_KEY") || "";
const GROQ_API = "https://api.groq.com/openai/v1";
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/";
const GROQ_TEXT_MODELS = [Deno.env.get("GROQ_TEXT_MODEL") || "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const GROQ_WHISPER_MODELS = [Deno.env.get("GROQ_WHISPER_MODEL") || "whisper-large-v3-turbo", "whisper-large-v3"];
const GEMINI_MODELS = [Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

// map a mime type to a file extension Groq's Whisper endpoint accepts
const extFor = (mime: string) => {
  const m = (mime || "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("wav")) return "wav";
  if (m.includes("flac")) return "flac";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  return "webm";
};
const b64ToBytes = (b64: string) => {
  const clean = b64.includes(",") ? b64.split(",").pop()! : b64; // tolerate data: URLs
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const cleanB64 = (b64: string) => (b64.includes(",") ? b64.split(",").pop()! : b64);

// ---------------- GROQ ----------------
async function groqChat(messages: any[], maxTokens: number) {
  if (!GROQ_KEY) throw new Error("GROQ_API_KEY not set");
  let lastErr = "AI request failed";
  for (const model of GROQ_TEXT_MODELS) {
    const r = await fetch(GROQ_API + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + GROQ_KEY },
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: maxTokens }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return { text: (d?.choices?.[0]?.message?.content || "").trim(), model };
    lastErr = d?.error?.message || ("HTTP " + r.status);
    if (!/model|decommission|not found|does not exist/i.test(lastErr)) break;
  }
  throw new Error(lastErr);
}
async function groqTranscribe(bytes: Uint8Array, mime: string, language?: string, context?: string) {
  if (!GROQ_KEY) throw new Error("GROQ_API_KEY not set");
  let lastErr = "Transcription failed";
  for (const model of GROQ_WHISPER_MODELS) {
    const fd = new FormData();
    fd.append("model", model);
    fd.append("file", new Blob([bytes], { type: mime || "audio/webm" }), "audio." + extFor(mime));
    fd.append("response_format", "json");
    fd.append("temperature", "0");
    if (language && /^[a-z]{2}$/i.test(language)) fd.append("language", language.toLowerCase());
    if (context) fd.append("prompt", String(context).slice(0, 500));
    const r = await fetch(GROQ_API + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + GROQ_KEY }, body: fd });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return { text: (d?.text || "").trim(), model };
    lastErr = d?.error?.message || ("HTTP " + r.status);
    if (!/model|decommission|not found|does not exist/i.test(lastErr)) break;
  }
  throw new Error(lastErr);
}

// ---------------- GEMINI (fallback) ----------------
async function geminiGenerate(parts: any[], system: string | undefined, maxTokens: number) {
  if (!GEMINI_KEY) throw new Error("GOOGLE_AI_API_KEY not set");
  let lastErr = "AI request failed";
  for (const model of GEMINI_MODELS) {
    const body: any = {
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens },
    };
    if (system) body.systemInstruction = { parts: [{ text: String(system) }] };
    const r = await fetch(GEMINI_API + model + ":generateContent?key=" + GEMINI_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      const txt = (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
      return { text: txt, model };
    }
    lastErr = d?.error?.message || ("HTTP " + r.status);
    if (!/model|not found|does not exist|unsupported/i.test(lastErr)) break;
  }
  throw new Error(lastErr);
}
function geminiTranscribeParts(audioB64: string, mime: string, language?: string, context?: string) {
  let instruction = "Transcribe this audio exactly as spoken, in the original language. Output ONLY the transcript text with no preamble, labels, or commentary.";
  if (language) instruction += " The audio is in " + language + ".";
  if (context) instruction += " Spell these names/terms correctly if they occur: " + String(context).slice(0, 300) + ".";
  return [{ text: instruction }, { inline_data: { mime_type: mime || "audio/wav", data: cleanB64(audioB64) } }];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (!GROQ_KEY && !GEMINI_KEY) return json({ error: "No AI provider key set (need GROQ_API_KEY or GOOGLE_AI_API_KEY)" }, 500);
  try {
    const body = await req.json().catch(() => ({} as any));

    // ---- audio transcription: Groq Whisper -> Gemini multimodal ----
    if (body.audio) {
      let groqErr = "";
      if (GROQ_KEY) {
        try {
          const { text, model } = await groqTranscribe(b64ToBytes(body.audio), body.mimeType || "audio/webm", body.language, body.context);
          return json({ text, model, engine: "groq-whisper" });
        } catch (e) { groqErr = (e as Error).message || "Groq failed"; }
      }
      if (GEMINI_KEY) {
        try {
          const { text, model } = await geminiGenerate(geminiTranscribeParts(body.audio, body.mimeType, body.language, body.context), undefined, 8192);
          return json({ text, model, engine: "gemini" });
        } catch (e) {
          return json({ error: "All providers failed — Groq: " + (groqErr || "no key") + " · Gemini: " + ((e as Error).message || "failed") }, 502);
        }
      }
      return json({ error: groqErr || "Transcription failed" }, 502);
    }

    // ---- text generation: Groq -> Gemini ----
    const maxTokens = body.maxTokens && body.maxTokens > 0 && body.maxTokens <= 4096 ? body.maxTokens : 1024;
    let groqErr = "";
    if (GROQ_KEY) {
      try {
        const messages: any[] = [];
        if (body.system) messages.push({ role: "system", content: String(body.system) });
        messages.push({ role: "user", content: String(body.prompt || "") });
        const { text, model } = await groqChat(messages, maxTokens);
        return json({ text, model, engine: "groq" });
      } catch (e) { groqErr = (e as Error).message || "Groq failed"; }
    }
    if (GEMINI_KEY) {
      try {
        const { text, model } = await geminiGenerate([{ text: String(body.prompt || "") }], body.system, maxTokens);
        return json({ text, model, engine: "gemini" });
      } catch (e) {
        return json({ error: "All providers failed — Groq: " + (groqErr || "no key") + " · Gemini: " + ((e as Error).message || "failed") }, 502);
      }
    }
    return json({ error: groqErr || "AI request failed" }, 502);
  } catch (e) { return json({ error: String(e) }, 500); }
});
