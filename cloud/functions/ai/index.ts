// ============================================================
// Kithra — Supabase Edge Function: AI gateway (Groq)
//   text  : Groq chat completions  (Llama 3.3 70B — fast, capable)
//   audio : Groq Whisper           (whisper-large-v3-turbo — fast STT)
// Secret required:  GROQ_API_KEY = <console.groq.com key>
// Optional overrides: GROQ_TEXT_MODEL, GROQ_WHISPER_MODEL
// Keeps the same request/response contract the web client already uses:
//   { prompt, system, maxTokens }            -> { text, model, engine }
//   { audio(base64), mimeType, language,     -> { text, model, engine }
//     context }
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const KEY = Deno.env.get("GROQ_API_KEY") || "";
const API = "https://api.groq.com/openai/v1";
const TEXT_MODELS = [Deno.env.get("GROQ_TEXT_MODEL") || "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const WHISPER_MODELS = [Deno.env.get("GROQ_WHISPER_MODEL") || "whisper-large-v3-turbo", "whisper-large-v3"];
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

// ---- Groq chat (text) ----
async function chat(messages: any[], maxTokens: number) {
  let lastErr = "AI request failed";
  for (const model of TEXT_MODELS) {
    const r = await fetch(API + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + KEY },
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: maxTokens }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return { text: (d?.choices?.[0]?.message?.content || "").trim(), model };
    lastErr = d?.error?.message || ("HTTP " + r.status);
    // only fall through to the next model when the model itself is the problem
    if (!/model|decommission|not found|does not exist/i.test(lastErr)) break;
  }
  throw new Error(lastErr);
}

// ---- Groq Whisper (audio -> text) ----
async function transcribe(bytes: Uint8Array, mime: string, language?: string, context?: string) {
  let lastErr = "Transcription failed";
  for (const model of WHISPER_MODELS) {
    const fd = new FormData();
    fd.append("model", model);
    fd.append("file", new Blob([bytes], { type: mime || "audio/webm" }), "audio." + extFor(mime));
    fd.append("response_format", "json");
    fd.append("temperature", "0");
    if (language && /^[a-z]{2}$/i.test(language)) fd.append("language", language.toLowerCase());
    if (context) fd.append("prompt", String(context).slice(0, 500)); // bias spelling of names/terms
    const r = await fetch(API + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + KEY }, body: fd });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return { text: (d?.text || "").trim(), model };
    lastErr = d?.error?.message || ("HTTP " + r.status);
    if (!/model|decommission|not found|does not exist/i.test(lastErr)) break;
  }
  throw new Error(lastErr);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (!KEY) return json({ error: "GROQ_API_KEY is not set on the server" }, 500);
  try {
    const body = await req.json().catch(() => ({} as any));

    // ---- audio transcription ----
    if (body.audio) {
      try {
        const { text, model } = await transcribe(b64ToBytes(body.audio), body.mimeType || "audio/webm", body.language, body.context);
        return json({ text, model, engine: "groq-whisper" });
      } catch (e) { return json({ error: (e as Error).message || "Transcription failed" }, 502); }
    }

    // ---- text generation ----
    const messages: any[] = [];
    if (body.system) messages.push({ role: "system", content: String(body.system) });
    messages.push({ role: "user", content: String(body.prompt || "") });
    const maxTokens = body.maxTokens && body.maxTokens > 0 && body.maxTokens <= 4096 ? body.maxTokens : 1024;
    try {
      const { text, model } = await chat(messages, maxTokens);
      return json({ text, model, engine: "groq" });
    } catch (e) { return json({ error: (e as Error).message || "AI request failed" }, 502); }
  } catch (e) { return json({ error: String(e) }, 500); }
});
