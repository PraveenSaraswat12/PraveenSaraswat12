import React from 'react';
import { Icon, RealPlayer, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import { Panel } from './screens-dashboard.jsx';
/* ============================================================
   LUMEN — Real audio upload + in-browser acoustic analysis
   Uses Web Audio API to decode and measure the actual file.
   ============================================================ */

// ---- real signal analysis ----
async function analyzeAudio(file, onProgress) {
  const arrayBuf = await file.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const audio = await ctx.decodeAudioData(arrayBuf.slice(0));
  ctx.close && ctx.close();

  const SR = audio.sampleRate;
  const ch = audio.getChannelData(0);
  const N = ch.length;
  const duration = audio.duration;

  const frameLen = Math.max(256, Math.floor(SR * 0.046)); // ~46ms frames
  const nFrames = Math.floor(N / frameLen);
  const step = nFrames > 26000 ? 2 : 1; // cap work on long files
  const rms = [], zcr = [], times = [];
  let maxRms = 0, sumRms = 0, cnt = 0;
  for (let f = 0; f < nFrames; f += step) {
    const start = f * frameLen;
    let sum = 0, zc = 0, prev = ch[start];
    for (let i = 1; i < frameLen; i++) {
      const s = ch[start + i];
      sum += s * s;
      if ((s >= 0) !== (prev >= 0)) zc++;
      prev = s;
    }
    const r = Math.sqrt(sum / frameLen);
    rms.push(r); zcr.push(zc / frameLen); times.push(start / SR);
    if (r > maxRms) maxRms = r;
    sumRms += r; cnt++;
    if (onProgress && (f % 400 === 0)) onProgress(f / nFrames);
  }
  const meanRms = sumRms / Math.max(1, cnt);

  // silence / talk
  const thresh = Math.max(0.012, maxRms * 0.13);
  let talk = 0, silence = 0, pauses = 0, longest = 0, run = 0, onsets = 0;
  const frameDur = (frameLen / SR) * step;
  for (let i = 0; i < rms.length; i++) {
    const active = rms[i] > thresh;
    if (active) {
      talk++;
      if (i > 0 && rms[i - 1] <= thresh) onsets++;
      if (run * frameDur >= 0.32) { pauses++; longest = Math.max(longest, run * frameDur); }
      run = 0;
    } else { silence++; run++; }
  }
  const talkRatio = talk / Math.max(1, talk + silence);

  // dynamics (expressiveness) = coefficient of variation of active energy
  let vSum = 0, vCnt = 0;
  for (let i = 0; i < rms.length; i++) if (rms[i] > thresh) { vSum += rms[i]; vCnt++; }
  const activeMean = vSum / Math.max(1, vCnt);
  let varSum = 0;
  for (let i = 0; i < rms.length; i++) if (rms[i] > thresh) varSum += (rms[i] - activeMean) ** 2;
  const cv = Math.sqrt(varSum / Math.max(1, vCnt)) / Math.max(1e-6, activeMean);
  const expressiveness = Math.round(Math.min(100, cv * 95));

  // pace estimate from onsets (syllable-ish → words)
  const minutes = duration / 60;
  const words = onsets / 1.45;
  const wpm = Math.round(words / Math.max(0.05, minutes));

  // brightness from zero-crossing rate
  let zSum = 0; for (let i = 0; i < zcr.length; i++) zSum += zcr[i];
  const brightness = Math.round(Math.min(100, (zSum / Math.max(1, zcr.length)) / 0.18 * 100));

  // loudness dBFS
  const dbfs = Math.round(20 * Math.log10(Math.max(1e-6, meanRms)));

  // downsample energy curve to ~50 pts (normalized)
  const M = 50;
  const energy = [];
  for (let i = 0; i < M; i++) {
    const a = Math.floor(i / M * rms.length), b = Math.floor((i + 1) / M * rms.length);
    let s = 0, c = 0; for (let j = a; j < b; j++) { s += rms[j]; c++; }
    energy.push({ x: i, y: maxRms ? (s / Math.max(1, c)) / maxRms : 0 });
  }

  // waveform peaks (~180)
  const P = 180, peaks = [];
  for (let i = 0; i < P; i++) {
    const a = Math.floor(i / P * N), b = Math.floor((i + 1) / P * N);
    let m = 0; for (let j = a; j < b; j += 16) { const v = Math.abs(ch[j]); if (v > m) m = v; }
    peaks.push(maxRms ? Math.min(1, m / maxRms) : 0);
  }

  // key moments: top local maxima in energy
  const cand = [];
  for (let i = 2; i < rms.length - 2; i++) {
    if (rms[i] > thresh * 1.4 && rms[i] >= rms[i - 1] && rms[i] > rms[i + 1]) cand.push({ t: times[i], e: rms[i] });
  }
  cand.sort((a, b) => b.e - a.e);
  const moments = [];
  for (const c of cand) { if (moments.every(m => Math.abs(m.t - c.t) > duration * 0.08)) moments.push(c); if (moments.length >= 3) break; }
  moments.sort((a, b) => a.t - b.t);

  return {
    name: file.name, sizeMB: (file.size / 1048576).toFixed(1),
    duration, sampleRate: SR, channels: audio.numberOfChannels,
    talkRatio, pauses, longestPause: longest, wpm: Math.max(0, wpm),
    expressiveness, brightness, dbfs, peaks, energy,
    moments: moments.map(m => m.t),
  };
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function RealWave({ peaks, color = 'var(--accent)' }) {
  return (
    <div className="wave" style={{ height: 64, '--wb-gap': '2px' }}>
      {peaks.map((h, i) => <i key={i} style={{ height: `${Math.max(4, Math.round(h * 100))}%`, background: color, opacity: 0.55 + 0.45 * h }} />)}
    </div>
  );
}

function summarize(r) {
  const tr = Math.round(r.talkRatio * 100);
  const paceWord = r.wpm > 175 ? 'brisk' : r.wpm > 130 ? 'steady' : 'measured';
  const dyn = r.expressiveness > 60 ? 'expressive and dynamic' : r.expressiveness > 35 ? 'fairly even' : 'calm and level';
  const momentStr = r.moments.length ? ` Energy peaked around ${r.moments.map(fmtTime).join(', ')}.` : '';
  return `This ${fmtTime(r.duration)} recording is ${tr >= 65 ? 'mostly speech' : tr >= 40 ? 'a balanced mix of speech and pauses' : 'sparse, with lots of quiet'} (${tr}% active voice). You spoke at a ${paceWord} ~${r.wpm} words/min with ${r.pauses} notable pause${r.pauses === 1 ? '' : 's'}. Your delivery was ${dyn}.${momentStr}`;
}

function Analyze() {
  const { mode, plan, planAllows, go, addClip, viewClip, setViewClip } = useApp();
  const [stage, setStage] = React.useState('idle'); // idle | recording | analyzing | done | error
  const [clipUrl, setClipUrl] = React.useState(null);
  const [progress, setProgress] = React.useState(0);
  const [res, setRes] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [drag, setDrag] = React.useState(false);
  const [aiSummary, setAiSummary] = React.useState('');
  const [recSecs, setRecSecs] = React.useState(0);
  const inputRef = React.useRef(null);
  const recRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const chunksRef = React.useRef([]);
  const recTimerRef = React.useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setStage('analyzing'); setProgress(0); setErr(''); setAiSummary('');
    try {
      const r = await analyzeAudio(file, (p) => setProgress(Math.min(0.98, p)));
      setRes(r); setProgress(1); setStage('done');
      // keep the real audio playable + save it to Recordings (this session)
      try {
        const url = URL.createObjectURL(file);
        setClipUrl(url);
        const source = /^Live recording/.test(file.name) ? 'listen' : 'upload';
        addClip({ id: 'clip-' + Date.now(), name: r.name, url, durSec: r.duration, peaks: r.peaks, source, analysis: r, ts: Date.now() });
      } catch (e) {}
      // optional: natural-language summary via Claude if available
      if (window.claude && typeof window.claude.complete === 'function') {
        try {
          const prompt = `You are Kithra, a calm conversation-intelligence assistant. Based ONLY on these acoustic measurements of one audio recording, write exactly 2 warm, insightful sentences addressed to the speaker. Plain text only — no heading, no markdown, no bullet points, no bold. Do not invent words spoken or topics (this is acoustic-only). Metrics: duration ${fmtTime(r.duration)}, active-voice ${Math.round(r.talkRatio*100)}%, pace ~${r.wpm} wpm, ${r.pauses} pauses, expressiveness ${r.expressiveness}/100, brightness ${r.brightness}/100.`;
          const out = await window.claude.complete(prompt);
          const clean = (out || '').replace(/^#+\s.*$/gm, '').replace(/[*_`#>]/g, '').replace(/\n{2,}/g, ' ').replace(/\s+/g, ' ').trim();
          if (clean) setAiSummary(clean);
        } catch (e) {}
      }
    } catch (e) {
      setErr('Could not decode that file. Try an MP3, WAV, M4A, or OGG audio file.');
      setStage('error');
    }
  };

  const reset = () => { setStage('idle'); setRes(null); setErr(''); setAiSummary(''); };

  // ---- live recording (MediaRecorder → same in-browser analysis) ----
  const stopTracks = () => { try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (e) {} streamRef.current = null; };
  const startRecording = async () => {
    setErr('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErr('Recording isn’t supported in this browser — try uploading a file instead.'); setStage('error'); return;
    }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { setErr('Microphone access was blocked. Allow the mic in your browser, or upload a file instead.'); setStage('error'); return; }
    streamRef.current = stream; chunksRef.current = [];
    let mr;
    try { mr = new MediaRecorder(stream); }
    catch (e) { stopTracks(); setErr('Recording isn’t supported here — try uploading a file instead.'); setStage('error'); return; }
    recRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      clearInterval(recTimerRef.current); stopTracks();
      if (!chunksRef.current.length) { setErr('That recording came through empty — please try again.'); setStage('error'); return; }
      const type = mr.mimeType || 'audio/webm';
      const ext = /mp4|aac/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm';
      handleFile(new File(chunksRef.current, `Live recording.${ext}`, { type }));
    };
    setRecSecs(0); setStage('recording'); mr.start();
    recTimerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000);
  };
  const stopRecording = () => { try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch (e) {} };
  const cancelRecording = () => {
    try { if (recRef.current && recRef.current.state !== 'inactive') { recRef.current.onstop = null; recRef.current.stop(); } } catch (e) {}
    clearInterval(recTimerRef.current); stopTracks(); reset();
  };
  React.useEffect(() => () => { clearInterval(recTimerRef.current); stopTracks(); }, []);

  // open a saved recording's insights (navigated from Recordings)
  React.useEffect(() => {
    if (!viewClip) return;
    setRes(viewClip.analysis); setClipUrl(viewClip.url); setAiSummary(''); setStage('done');
    setViewClip(null);
  }, [viewClip]);

  return (
    <div className="page">
      <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-end', marginBottom:8, flexWrap:'wrap', gap:14 }}>
        <div className="stack" style={{ gap:6 }}>
          <span className="eyebrow">Try it now</span>
          <h1 className="display" style={{ fontSize:28, margin:0, whiteSpace:'nowrap' }}>Analyze a recording</h1>
        </div>
        {stage==='done' && <button className="btn btn-soft" onClick={reset}><Icon name="refresh" size={16} />Analyze another</button>}
      </div>
      <p className="muted" style={{ margin:'0 0 var(--gap)', fontSize:14.5, maxWidth:620, lineHeight:1.55 }}>
        Record straight from your mic or upload an audio file, and Kithra runs a <strong>real acoustic analysis right in your browser</strong> — nothing is uploaded anywhere. You’ll see your actual waveform, energy, pacing, and pauses.
      </p>

      <input ref={inputRef} type="file" accept="audio/*" style={{ display:'none' }} onChange={e=>handleFile(e.target.files[0])} />

      {stage==='idle' && (
        <div className={`dropzone ${drag?'drag':''}`} onClick={()=>inputRef.current?.click()}
          onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}>
          <div className="dz-ic"><Icon name="mic" size={28} /></div>
          <h3 className="display" style={{ fontSize:22, margin:'0 0 6px' }}>Record or drop an audio file</h3>
          <p className="muted" style={{ margin:'0 auto 16px', maxWidth:400, fontSize:14, lineHeight:1.5 }}>
            Record live from your microphone, or use an MP3, WAV, M4A, or OGG. A short voice memo or a recorded call both work great.
          </p>
          <div className="row center" style={{ gap:10, flexWrap:'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={(e)=>{ e.stopPropagation(); startRecording(); }}>
              <span style={{ width:9, height:9, borderRadius:'50%', background:'currentColor', display:'inline-block' }} />Record audio
            </button>
            <span className="btn btn-soft"><Icon name="upload" size={16} />Choose audio file</span>
          </div>
          <div style={{ marginTop:18, opacity:.6 }}><Waveform bars={44} seed={11} height={26} gap={3} color="var(--line-2)" /></div>
          <PrivacyChip text="Processed locally — never leaves your device" />
        </div>
      )}

      {stage==='analyzing' && (
        <div className="card card-pad center" style={{ minHeight:280, textAlign:'center' }}>
          <div className="stack center" style={{ gap:20, maxWidth:380 }}>
            <LiveWave bars={36} height={70} color="var(--accent)" />
            <div className="stack" style={{ gap:6 }}>
              <h3 className="display" style={{ fontSize:22, margin:0 }}>Measuring your audio…</h3>
              <p className="faint" style={{ fontSize:13, margin:0 }}>Decoding samples · reading energy, pacing & pauses</p>
            </div>
            <div className="bar" style={{ height:8, width:240 }}><i style={{ width:`${Math.round(progress*100)}%`, transition:'width .2s linear' }} /></div>
          </div>
        </div>
      )}

      {stage==='recording' && (
        <div className="card card-pad center" style={{ minHeight:280, textAlign:'center' }}>
          <div className="stack center" style={{ gap:18, maxWidth:420 }}>
            <span className="row center" style={{ gap:8, color:'var(--bad)', fontWeight:700, fontSize:13.5, letterSpacing:'.04em' }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background:'var(--bad)', display:'inline-block' }} />REC
            </span>
            <LiveWave bars={36} height={70} color="var(--bad)" />
            <div className="metric-num tnum" style={{ fontSize:34 }}>{fmtTime(recSecs)}</div>
            <p className="faint" style={{ fontSize:13, margin:0, maxWidth:320, lineHeight:1.5 }}>Speak naturally. Your audio is recorded and analyzed entirely on your device.</p>
            <div className="row center" style={{ gap:10 }}>
              <button className="btn btn-primary" onClick={stopRecording}><Icon name="check" size={16} />Stop &amp; analyze</button>
              <button className="btn btn-ghost" onClick={cancelRecording}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {stage==='error' && (
        <div className="card card-pad center" style={{ minHeight:200 }}>
          <div className="stack center" style={{ gap:14 }}>
            <span className="center" style={{ width:48, height:48, borderRadius:14, background:'var(--bad-soft)', color:'var(--bad)' }}><Icon name="x" size={24} /></span>
            <p className="muted" style={{ margin:0, textAlign:'center', maxWidth:340 }}>{err}</p>
            <button className="btn btn-primary" onClick={reset}>Try another file</button>
          </div>
        </div>
      )}

      {stage==='done' && res && <AnalyzeResults res={res} aiSummary={aiSummary} mode={mode} clipUrl={clipUrl} planAllows={planAllows} go={go} />}
    </div>
  );
}

// honest, rule-based coaching derived from the REAL acoustic measurements
function speakingInsights(r) {
  const tr = Math.round(r.talkRatio * 100);
  const out = [];
  out.push(r.wpm > 175
    ? { ic:'bolt', title:`Brisk pace · ~${r.wpm} wpm`, body:'You’re speaking quickly. Slowing slightly on key points helps listeners absorb them.' }
    : r.wpm < 120
    ? { ic:'clock', title:`Measured pace · ~${r.wpm} wpm`, body:'Calm and deliberate — good for clarity. Add a little energy on highlights to keep momentum.' }
    : { ic:'bolt', title:`Steady pace · ~${r.wpm} wpm`, body:'A comfortable, easy-to-follow speaking rate.' });
  out.push(r.pauses === 0
    ? { ic:'wave', title:'Very few pauses', body:'You rarely paused. Intentional pauses give your points room to land and read as confidence.' }
    : { ic:'pause', title:`${r.pauses} notable pause${r.pauses>1?'s':''}`, body:`Longest was ${r.longestPause.toFixed(1)}s. Well-placed pauses make you sound composed and in control.` });
  out.push({ ic:'mic', title:`${tr}% active voice`, body: tr>=70 ? 'Mostly speech with little dead air.' : tr>=45 ? 'A balanced mix of talking and quiet/listening.' : 'Lots of quiet — reflective, lighter on spoken content.' });
  out.push({ ic:'spark', title: r.expressiveness>55?'Animated delivery':r.expressiveness>30?'Balanced energy':'Calm, level tone',
    body:`Expressiveness ${r.expressiveness}/100 — ${r.expressiveness>55?'lively variation keeps attention.':r.expressiveness>30?'a steady, grounded feel.':'try adding vocal variety on points you want to emphasize.'}` });
  return out;
}

// ---- on-device speech-to-text (Whisper via transformers.js, loaded on demand) ----
let _asr = null;
// load transformers.js, trying a few CDN forms for resilience
async function loadTransformers() {
  const urls = [
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3',
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm',
    'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2',
  ];
  let lastErr;
  for (const u of urls) {
    try { const m = await import(/* @vite-ignore */ u); if (m && m.pipeline) return m; } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Could not load the on-device AI library');
}
async function getTranscriber(onProgress) {
  if (_asr) return _asr;
  const build = (async () => {
    const mod = await loadTransformers();
    if (mod.env) mod.env.allowLocalModels = false;
    return await mod.pipeline('automatic-speech-recognition', 'Xenova/whisper-base', { progress_callback: onProgress });
  })();
  _asr = build;
  try { return await build; } catch (e) { _asr = null; throw e; }
}
// decode any audio source (object URL) → 16kHz mono Float32Array for Whisper
async function to16kMono(src) {
  const arrayBuf = await (await fetch(src)).arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const tmp = new AC();
  const decoded = await tmp.decodeAudioData(arrayBuf.slice(0));
  tmp.close && tmp.close();
  const SR = 16000;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new OAC(1, Math.max(1, Math.ceil(decoded.duration * SR)), SR);
  const node = off.createBufferSource(); node.buffer = decoded; node.connect(off.destination); node.start();
  const rendered = await off.startRendering();
  return rendered.getChannelData(0);
}
// encode a Float32 PCM array as a base64 16-bit WAV (for cloud/Gemini transcription)
function floatToWavBase64(float32, sr) {
  const n = float32.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
  let o = 44; for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, float32[i])); dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2; }
  const bytes = new Uint8Array(buf); let bin = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}
function transcriptInsights(text, durSec) {
  const words = text.match(/[A-Za-z0-9’']+/g) || [];
  const wc = words.length;
  const wpm = durSec ? Math.round(wc / (durSec / 60)) : 0;
  const fillers = (text.match(/\b(um+|uh+|er+|like|you know|sort of|kind of|basically|actually|literally)\b/gi) || []).length;
  return { wc, wpm, fillers };
}

function TranscriptPanel({ clipUrl, durSec }) {
  const [state, setState] = React.useState('idle'); // idle | loading | running | done | error
  const [text, setText] = React.useState('');
  const [prog, setProg] = React.useState(0);
  const [err, setErr] = React.useState('');
  const [lang, setLang] = React.useState(''); // '' = auto-detect
  const [ctx, setCtx] = React.useState(''); // names/terms to spell right
  const [engine, setEngine] = React.useState('');
  const cloudOn = !!(window.KithraCloud && window.KithraCloud.configured && window.KithraCloud.configured());
  const run = async () => {
    if (!clipUrl) return;
    setErr('');
    try {
      if (cloudOn) {
        // accurate cloud transcription (Google Gemini): decode → 16kHz WAV → send
        setState('running'); setEngine('Kithra Cloud · Google');
        const audio = await to16kMono(clipUrl);
        const b64 = floatToWavBase64(audio, 16000);
        const t = await window.KithraCloud.transcribe(b64, { mimeType: 'audio/wav', language: lang || undefined, context: ctx || undefined });
        setText((t || '').trim()); setState('done');
        return;
      }
      // on-device fallback (Whisper)
      setState('loading'); setProg(0); setEngine('On-device');
      const transcriber = await getTranscriber((p) => { if (p && typeof p.progress === 'number') setProg(p.progress); });
      setState('running');
      const audio = await to16kMono(clipUrl);
      const out = await transcriber(audio, { chunk_length_s: 30, stride_length_s: 5, language: lang || undefined, task: 'transcribe' });
      setText(((out && out.text) || '').trim()); setState('done');
    } catch (e) {
      setErr(cloudOn
        ? 'Cloud transcription failed: ' + (e && e.message ? e.message : e) + '. Make sure the AI function is deployed, then try again.'
        : 'Couldn’t run on-device transcription here. Try Chrome with a stable connection.');
      setState('error');
    }
  };
  const ins = state === 'done' ? transcriptInsights(text, durSec) : null;
  const langSelect = (
    <label className="row" style={{ gap: 7, alignItems: 'center', fontSize: 12.5 }}>
      <span className="faint">Language</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)}
        style={{ height: 34, padding: '0 8px', borderRadius: 'var(--r-ctrl)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', font: 'inherit' }}>
        <option value="">Auto-detect</option>
        <option value="english">English</option>
        <option value="hindi">Hindi</option>
        <option value="spanish">Spanish</option>
        <option value="french">French</option>
        <option value="german">German</option>
        <option value="portuguese">Portuguese</option>
        <option value="arabic">Arabic</option>
        <option value="chinese">Chinese</option>
        <option value="japanese">Japanese</option>
        <option value="russian">Russian</option>
      </select>
    </label>
  );
  const ctxInput = (
    <input className="field" value={ctx} onChange={(e) => setCtx(e.target.value)}
      placeholder="Names / terms to spell right (e.g. Praveen, Houston, ATS)"
      style={{ height: 34, flex: '1 1 240px', minWidth: 180 }} />
  );
  return (
    <Panel title="Transcript" sub={cloudOn ? 'Accurate transcription via Google Gemini' : 'Runs privately on your device, no upload'}>
      {state === 'idle' && (
        <div className="stack" style={{ gap: 12 }}>
          <p className="faint" style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>
            {cloudOn
              ? 'High-accuracy cloud transcription (Google Gemini), great with accents and names. Add any names or terms below so they’re spelled correctly.'
              : 'On-device transcription (private, works offline). The first run downloads a model (~145 MB). For best accuracy, connect the cloud in Privacy → Cloud & account.'}
          </p>
          <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{langSelect}{ctxInput}</div>
          <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={run}><Icon name="spark" size={14} fill />{cloudOn ? 'Transcribe (accurate)' : 'Transcribe with on-device AI'}</button>
        </div>
      )}
      {state === 'loading' && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="faint" style={{ fontSize: 13 }}>Loading the AI model… {Math.round(prog)}%</span>
          <div className="bar" style={{ height: 8 }}><i style={{ width: `${Math.max(4, Math.round(prog))}%`, transition: 'width .3s' }} /></div>
        </div>
      )}
      {state === 'running' && (
        <div className="row" style={{ gap: 12 }}><LiveWave bars={22} height={34} color="var(--accent)" /><span className="faint" style={{ fontSize: 13 }}>Transcribing your audio…</span></div>
      )}
      {state === 'error' && (
        <div className="stack" style={{ gap: 10 }}><p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{err}</p><button className="btn btn-soft btn-sm" style={{ alignSelf: 'flex-start' }} onClick={run}>Try again</button></div>
      )}
      {state === 'done' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            {engine && <span className="badge badge-good" style={{ height: 22 }}><Icon name="spark" size={11} fill />{engine}</span>}
            {ins && <><span className="tag"><Icon name="file" size={12} />{ins.wc} words</span>
              <span className="tag"><Icon name="bolt" size={12} />{ins.wpm} wpm spoken</span>
              {ins.fillers > 0 && <span className="tag"><Icon name="wave" size={12} />{ins.fillers} filler{ins.fillers > 1 ? 's' : ''}</span>}</>}
          </div>
          <div className="card" style={{ padding: '14px 16px', background: 'var(--surface-2)', maxHeight: 240, overflow: 'auto' }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{text || '(No clear speech detected in this audio.)'}</p>
          </div>
          <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{langSelect}{ctxInput}
            <button className="btn btn-soft btn-sm" onClick={run}><Icon name="refresh" size={14} />Re-run</button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function AnalyzeResults({ res, aiSummary, mode, clipUrl, planAllows, go }) {
  const { books } = useApp();
  const metrics = [
    { label:'Duration', value:fmtTime(res.duration), ic:'clock' },
    { label:'Active voice', value:`${Math.round(res.talkRatio*100)}%`, ic:'wave', sub:'talk vs. silence' },
    { label:'Speaking pace', value:`${res.wpm}`, unit:'wpm', ic:'bolt', sub:'estimated from rhythm' },
    { label:'Pauses', value:`${res.pauses}`, ic:'pause', sub:`longest ${res.longestPause.toFixed(1)}s` },
    { label:'Expressiveness', value:`${res.expressiveness}`, unit:'/100', ic:'spark', sub:'energy variation' },
    { label:'Avg loudness', value:`${res.dbfs}`, unit:'dB', ic:'trend', sub:'full-scale' },
  ];
  return (
    <div className="stack" style={{ gap:'var(--gap)' }}>
      {/* waveform + summary */}
      <div className="card card-pad anim-up">
        <div className="row" style={{ justifyContent:'space-between', marginBottom:14, gap:12, flexWrap:'wrap' }}>
          <div className="row" style={{ gap:11, minWidth:0 }}>
            <span className="center" style={{ width:40, height:40, borderRadius:11, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name="wave" size={20} /></span>
            <div className="stack" style={{ gap:2, minWidth:0 }}>
              <span style={{ fontWeight:700, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{res.name}</span>
              <span className="faint" style={{ fontSize:12 }}>{res.sizeMB} MB · {(res.sampleRate/1000).toFixed(1)} kHz · {res.channels===1?'mono':'stereo'}</span>
            </div>
          </div>
          <Badge kind="good" dot>Analyzed locally</Badge>
        </div>
        {clipUrl
          ? <RealPlayer src={clipUrl} peaks={res.peaks} durSec={res.duration} />
          : (<>
              <RealWave peaks={res.peaks} />
              <div className="row" style={{ justifyContent:'space-between', marginTop:8 }}>
                <span className="faint tnum" style={{ fontSize:11.5 }}>0:00</span>
                <span className="faint tnum" style={{ fontSize:11.5 }}>{fmtTime(res.duration)}</span>
              </div>
            </>)}
        <div className="card" style={{ marginTop:16, padding:'14px 16px', background:'var(--surface-2)', display:'flex', gap:12, alignItems:'flex-start' }}>
          <span className="center" style={{ width:30, height:30, borderRadius:9, background:'var(--accent)', color:'var(--accent-ink)', flex:'none' }}><Icon name="spark" size={16} /></span>
          <div className="stack" style={{ gap:4 }}>
            <span className="eyebrow">Kithra’s read{aiSummary?'':' (from your audio)'}</span>
            <p style={{ margin:0, fontSize:14, lineHeight:1.6 }}>{aiSummary || summarize(res)}</p>
          </div>
        </div>
      </div>

      {/* metrics */}
      <div className="grid g-3 anim-up">
        {metrics.map((m,i)=>(
          <div key={i} className="card card-pad metric">
            <span className="label"><Icon name={m.ic} size={15} />{m.label}</span>
            <div className="val"><span className="metric-num n" style={{ fontSize:30 }}>{m.value}</span>{m.unit && <span className="u">{m.unit}</span>}</div>
            {m.sub && <span className="faint" style={{ fontSize:12, marginTop:8, display:'block' }}>{m.sub}</span>}
          </div>
        ))}
      </div>

      {/* deeper speaking insights — Plus */}
      {planAllows && planAllows('plus') ? (
       <>
        {clipUrl && <TranscriptPanel clipUrl={clipUrl} durSec={res.duration} />}
        <Panel title="Speaking insights" sub="A coaching read from your real acoustics">
          <div className="grid g-2">
            {speakingInsights(res).map((it,i)=>(
              <div key={i} className="row" style={{ gap:11, padding:'12px 14px', borderRadius:'var(--r-ctrl)', background:'var(--surface-2)', border:'1px solid var(--line)', alignItems:'flex-start' }}>
                <span className="center" style={{ width:34, height:34, borderRadius:10, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name={it.ic} size={17} /></span>
                <div className="stack" style={{ gap:2, minWidth:0 }}>
                  <span style={{ fontWeight:650, fontSize:13.5 }}>{it.title}</span>
                  <span className="faint" style={{ fontSize:12.5, lineHeight:1.5 }}>{it.body}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        {Array.isArray(books) && books.length>0 && (
          <Panel title="Informed by your library" sub="Kithra grounds suggestions in the books you trust">
            <EvidenceList items={books.slice(0,5).map(b=>({ title:b.title, author:b.author, type:b.type }))} label="Drawing on" />
            <button className="btn btn-soft btn-sm" style={{ marginTop:12 }} onClick={()=>go && go('books')}><Icon name="book" size={14} />Manage your books</button>
          </Panel>
        )}
       </>
      ) : (
        <div className="card card-pad" style={{ background:'var(--accent-soft)', border:'1px solid color-mix(in srgb,var(--accent) 22%,transparent)' }}>
          <div className="row" style={{ gap:11, marginBottom:8 }}>
            <span className="center" style={{ width:34, height:34, borderRadius:10, background:'var(--accent)', color:'var(--accent-ink)', flex:'none' }}><Icon name="spark" size={17} fill /></span>
            <span style={{ fontWeight:700, fontSize:15 }}>Unlock deeper speaking insights with Plus</span>
          </div>
          <p className="muted" style={{ margin:'0 0 12px', fontSize:13.5, lineHeight:1.6 }}>Plus turns these measurements into coaching — pace, pausing, energy and talk-balance guidance tuned to this recording. Your audio still stays on your device.</p>
          <button className="btn btn-primary btn-sm" onClick={()=>go && go('pricing')}><Icon name="spark" size={14} fill />See Plus</button>
        </div>
      )}

      {/* energy chart + key moments */}
      <div className="grid g-2">
        <Panel title="Vocal energy over time" sub="Loudness envelope measured from the waveform">
          <LineChart series={[{ color:'var(--accent)', data:res.energy }]} height={170} yMin={0} yMax={1.05} labels={res.energy.map(()=> '')} />
          <div className="row" style={{ justifyContent:'space-between', marginTop:8 }}>
            <span className="faint tnum" style={{ fontSize:11.5 }}>0:00</span>
            <span className="faint tnum" style={{ fontSize:11.5 }}>{fmtTime(res.duration)}</span>
          </div>
        </Panel>
        <Panel title="Key moments" sub="Highest-energy points in the recording">
          {res.moments.length ? (
            <div className="stack" style={{ gap:9 }}>
              {res.moments.map((t,i)=>(
                <div key={i} className="row" style={{ gap:12, padding:'11px 12px', borderRadius:'var(--r-ctrl)', background:'var(--surface-2)', border:'1px solid var(--line)' }}>
                  <span className="center" style={{ width:34, height:34, borderRadius:10, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name="flame" size={17} /></span>
                  <div className="stack grow" style={{ gap:1 }}>
                    <span style={{ fontWeight:650, fontSize:13.5 }}>Energy peak {i+1}</span>
                    <span className="faint" style={{ fontSize:12 }}>A louder, more emphatic moment</span>
                  </div>
                  <span className="tag tnum" style={{ flex:'none' }}><Icon name="clock" size={12} />{fmtTime(t)}</span>
                </div>
              ))}
            </div>
          ) : <p className="faint" style={{ fontSize:13 }}>No strong peaks detected — a calm, even recording.</p>}
          <div className="row wrap" style={{ gap:18, marginTop:16, paddingTop:14, borderTop:'1px solid var(--line)' }}>
            <div className="stack" style={{ gap:3 }}><span className="faint" style={{ fontSize:11.5, fontWeight:600 }}>Vocal brightness</span><span style={{ fontSize:16, fontWeight:700 }}>{res.brightness}/100</span></div>
            <div className="stack" style={{ gap:3 }}><span className="faint" style={{ fontSize:11.5, fontWeight:600 }}>Tone</span><span style={{ fontSize:16, fontWeight:700 }}>{res.expressiveness>55?'Animated':res.expressiveness>30?'Balanced':'Calm'}</span></div>
          </div>
        </Panel>
      </div>

      {/* what needs a backend */}
      <div className="card card-pad" style={{ background:'var(--surface-2)' }}>
        <div className="row" style={{ gap:11, marginBottom:10 }}>
          <span className="center" style={{ width:32, height:32, borderRadius:9, background:'var(--accent-soft)', color:'var(--accent-strong)' }}><Icon name="layers" size={17} /></span>
          <span style={{ fontWeight:700, fontSize:15 }}>This is the acoustic layer — the full picture needs Kithra’s secure backend</span>
        </div>
        <p className="muted" style={{ margin:'0 0 14px', fontSize:13.5, lineHeight:1.6 }}>
          Everything above was measured from your real audio, on-device. <strong>Transcription, who-said-what, objections, sentiment from words, and cross-call patterns</strong> require server-side speech-to-text and language models — that’s what a production backend adds.
        </p>
        <div className="row wrap" style={{ gap:8 }}>
          {['Speech-to-text transcript','Speaker diarization','Word-level sentiment','Topic & objection detection','Cross-recording patterns'].map((x,i)=>(
            <span key={i} className="tag"><Icon name="lock" size={12} />{x}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Analyze });


export { Analyze };
