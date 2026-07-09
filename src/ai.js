/* ============================================================
   KITHRA — shared AI layer (Gemini/Gemma via the Edge Function)
   One context-builder used across the whole app, so every answer
   is grounded in the user's REAL recordings, transcripts, metrics
   and book library — the "memory context".
   ============================================================ */
const fmtDur = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;

export function aiReady() {
  try { return !!(window.KithraCloud && window.KithraCloud.configured && window.KithraCloud.configured()); } catch (e) { return false; }
}

function clipLine(c, i) {
  const a = c.analysis || {};
  const bits = [
    `#${i + 1} "${c.name || 'Recording'}"`,
    a.duration != null ? `length ${fmtDur(a.duration)}` : (c.durSec != null ? `length ${fmtDur(c.durSec)}` : null),
    a.wpm != null ? `pace ${a.wpm} wpm` : null,
    a.talkRatio != null ? `${Math.round(a.talkRatio * 100)}% active voice` : null,
    a.pauses != null ? `${a.pauses} pauses` : null,
    a.expressiveness != null ? `expressiveness ${a.expressiveness}/100` : null,
    c.ts ? `recorded ${new Date(c.ts).toLocaleDateString()}` : null,
  ].filter(Boolean).join(' · ');
  const t = (c.transcript || '').trim();
  return bits + (t ? `\n   transcript excerpt: "${t.slice(0, 360)}${t.length > 360 ? '…' : ''}"` : '\n   (not transcribed yet)');
}

// Build the grounding context Kithra "remembers"
export function buildContext({ clips = [], books = [], focus = null, mode = 'business' } = {}) {
  const lines = [];
  lines.push(`USER MODE: ${mode === 'business' ? 'business (sales & work conversations)' : 'personal (self-reflection & wellbeing)'}.`);
  if (focus) {
    const t = (focus.transcript || '').trim();
    lines.push(`FOCUSED RECORDING (the user is asking about THIS one): ${clipLine(focus, 0)}`);
    if (t) lines.push(`FULL TRANSCRIPT OF FOCUSED RECORDING:\n"""${t.slice(0, 4000)}${t.length > 4000 ? '…' : ''}"""`);
  }
  const others = clips.filter(c => !focus || c.id !== focus.id).slice(0, 8);
  if (others.length) {
    lines.push(`OTHER RECORDINGS IN THE USER'S LIBRARY (${others.length} shown):`);
    others.forEach((c, i) => lines.push(clipLine(c, i)));
  } else if (!focus) {
    lines.push('THE USER HAS NO RECORDINGS YET.');
  }
  if (books && books.length) {
    lines.push(`THE USER'S BOOK LIBRARY (ground advice in these where relevant): ${books.slice(0, 8).map(b => `${b.title}${b.author ? ' by ' + b.author : ''}`).join('; ')}.`);
  }
  return lines.join('\n');
}

const PERSONA = (mode) =>
  `You are Kithra — "Where talk becomes insight" — a ${mode === 'business' ? 'sharp, practical conversation coach for sales & work' : 'warm, gentle self-reflection coach'}. ` +
  `Answer ONLY from the context provided about the user's real recordings; never invent recordings, names, metrics or quotes that are not in the context. ` +
  `If the context lacks what's needed, say so plainly and tell the user what to record or transcribe next. ` +
  `Plain text only — no markdown, no headings, no bullets unless asked. Keep it to 2-5 short sentences unless asked for more.`;

// Conversational answer grounded in the user's real data
export async function askKithra({ question, mode, clips, books, focus, history = [], language }) {
  if (!aiReady()) throw new Error('cloud-off');
  const ctx = buildContext({ clips, books, focus, mode });
  const hist = history.slice(-6).map(m => `${m.role === 'me' ? 'User' : 'Kithra'}: ${m.text}`).join('\n');
  const sys = PERSONA(mode) + (language && language !== 'auto' ? ` Reply in ${language}.` : '');
  const prompt = `CONTEXT ABOUT THE USER'S REAL DATA:\n${ctx}\n\n${hist ? 'CONVERSATION SO FAR:\n' + hist + '\n\n' : ''}USER'S QUESTION: ${question}`;
  return await window.KithraCloud.askAI(prompt, sys);
}

// Structured insights for one recording (summary / wins / improvements / next step)
export async function clipInsights(clip, mode) {
  if (!aiReady()) throw new Error('cloud-off');
  const ctx = buildContext({ clips: [], books: [], focus: clip, mode });
  const sys = PERSONA(mode) + ' You are generating a structured analysis card.';
  const prompt =
    `CONTEXT:\n${ctx}\n\n` +
    `Analyze THIS recording. Respond in EXACTLY this format (plain text, keep each line under 30 words):\n` +
    `SUMMARY: <2 sentence summary of what was said/how it went>\n` +
    `TONE: <one word: positive, neutral, or negative — the overall tone of THIS conversation>\n` +
    `WIN: <one thing that went well>\n` +
    `IMPROVE: <one concrete thing to improve>\n` +
    `NEXT: <the single best next action>\n` +
    `RECOMMEND: <one specific, content-aware coaching tip referencing what was actually said>`;
  const out = await window.KithraCloud.askAI(prompt, sys);
  const grab = (k) => { const m = out.match(new RegExp(k + ':\\s*([^\\n]+)', 'i')); return m ? m[1].trim() : ''; };
  const toneWord = grab('TONE').toLowerCase();
  const tone = /positive|negative|neutral/.test(toneWord)
    ? { label: toneWord.match(/positive|negative|neutral/)[0], score: toneWord.includes('positive') ? 0.6 : toneWord.includes('negative') ? -0.6 : 0, method: 'ai' }
    : null;
  const res = { summary: grab('SUMMARY'), win: grab('WIN'), improve: grab('IMPROVE'), next: grab('NEXT'), recommend: grab('RECOMMEND'), tone, raw: out };
  if (!res.summary && out) res.summary = out.split('\n')[0].slice(0, 240);
  return res;
}

if (typeof window !== 'undefined') window.KithraAI = { aiReady, buildContext, askKithra, clipInsights };
