import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import * as Lock from './tab-lock.js';
/* ============================================================
   LUMEN — Live Capture host (app-level, persists across screens)
   Listen + Conversation modes, minimize-to-background with a
   permission ask, and a floating indicator pill.
   ============================================================ */
const LANG_REC = { auto:(navigator.language||'en-US'), 'en-US':'en-US', 'es-ES':'es-ES', 'hi-IN':'hi-IN', 'fr-FR':'fr-FR', 'de-DE':'de-DE', 'pt-BR':'pt-BR' };
const LANG_REPLY = { auto:'the user’s language', 'en-US':'English', 'es-ES':'Spanish', 'hi-IN':'Hindi', 'fr-FR':'French', 'de-DE':'German', 'pt-BR':'Portuguese' };
const capStripMd = (s) => String(s).replace(/\*\*/g,'').replace(/[*_`#>]/g,'').trim();

function lumenContext(mode) {
  const lib = window.LUMEN[mode];
  const titles = lib.recent.slice(0, 3).map(r => r.title);
  const count = mode === 'business' ? '1,000' : '24';
  const blurb = mode === 'business'
    ? `The user has ${count} previously analyzed sales calls. Known patterns: multi-threading to 3+ stakeholders wins deals; the most common objection is budget; sentiment lifts when a peer customer is mentioned. Recent calls: ${titles.join('; ')}.`
    : `The user has ${count} previously recorded personal reflections. Known patterns: calmer tone in the mornings, a reflex habit of over-apologizing, listening more lately. Recent recordings: ${titles.join('; ')}.`;
  return { count, titles, blurb };
}

function LiveCaptureHost() {
  const { capture, closeCapture, minimizeCapture, expandCapture, setCapMode, mode, voicePrefs, go, clips, books, addClip } = useApp();
  const V = window.LumenVoice || {};
  const capMode = capture.capMode || 'listen';
  const ctx = React.useMemo(() => lumenContext(mode), [mode]);
  const recLang = LANG_REC[voicePrefs.lang] || 'en-US';
  const replyLang = LANG_REPLY[voicePrefs.lang] || 'English';

  const [running, setRunning] = React.useState(false);
  const [secs, setSecs] = React.useState(0);
  const [transcript, setTranscript] = React.useState('');
  const [interim, setInterim] = React.useState('');
  const [exchanges, setExchanges] = React.useState([]);
  const [thinking, setThinking] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [askBg, setAskBg] = React.useState(false);
  const [showRecNotice, setShowRecNotice] = React.useState(false);
  const [nativeCap, setNativeCap] = React.useState(false);
  const [lockedElsewhere, setLockedElsewhere] = React.useState(false);
  const recRef = React.useRef(null);
  const wantRef = React.useRef(false);
  const busyRef = React.useRef(false);
  const exRef = React.useRef([]); exRef.current = exchanges;
  const transcriptRef = React.useRef(''); transcriptRef.current = transcript;
  const secsRef = React.useRef(0); secsRef.current = secs;
  const feedRef = React.useRef(null);
  // ---- autosave plumbing: a live session is recorded as real audio (not just
  // a transcript) and checkpointed periodically, so Stop, closing the overlay,
  // switching mode, or the tab/browser closing mid-capture never loses it ----
  const streamRef = React.useRef(null);
  const mediaRecRef = React.useRef(null);
  const chunksRef = React.useRef([]);
  const clipIdRef = React.useRef(null);
  const startedAtRef = React.useRef(0);
  const lastUrlRef = React.useRef(null);
  const savingRef = React.useRef(false);
  const audioGenRef = React.useRef(0);
  const CHECKPOINT_MS = 12000;

  React.useEffect(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; }, [exchanges, transcript, interim, thinking]);
  // native (Android) device-audio capture available? → reveal the option
  React.useEffect(() => { let on=true; (async()=>{ try{ const ok=await window.KithraSystemAudio?.isSupported?.(); if(on) setNativeCap(!!ok); }catch(e){} })(); return ()=>{ on=false; }; }, []);

  // ---- real audio recording, alongside the live transcript (best-effort: the
  // transcript still works even if mic-for-recording is blocked/unsupported) ----
  // Starts fresh, or RESUMES a merely-paused recorder (pauseAudioRecording,
  // below) so pausing then resuming keeps recording into the SAME continuous
  // clip instead of losing everything captured before the pause.
  const startAudioRecording = () => {
    try {
      const existing = mediaRecRef.current;
      if (existing && existing.state === 'paused') { existing.resume(); return; }
      if (existing && existing.state === 'recording') return;
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return;
      // generation token: a rapid Start→Stop→Start can leave an earlier
      // getUserMedia() promise resolving AFTER a newer one has already taken
      // over — without this, the stale resolution would open a second stream
      // that never gets released (a silently-open mic).
      const gen = ++audioGenRef.current;
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        if (!wantRef.current || gen !== audioGenRef.current) { try { stream.getTracks().forEach(t => t.stop()); } catch (e) {} return; }
        streamRef.current = stream;
        chunksRef.current = [];
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
        mr.start(3000); // flush a chunk every 3s so periodic checkpoints have fresh audio
        mediaRecRef.current = mr;
      }).catch(() => {});
    } catch (e) {}
  };
  // Pauses WITHOUT releasing the mic/recorder, so a later resume can append
  // more audio to the same clip (used by Stop, which the UI presents as
  // Pause/Resume). Returns a promise that resolves once requestData()'s flush
  // has actually landed in chunksRef — that event fires ASYNCHRONOUSLY, so a
  // caller that reads chunksRef right after calling this WITHOUT awaiting it
  // would race ahead of the flush and see stale/empty data (concretely: a
  // session that pauses quickly, before the recorder's own periodic timeslice
  // would otherwise have flushed anything on its own).
  const pauseAudioRecording = () => new Promise((resolve) => {
    try {
      const mr = mediaRecRef.current;
      if (!mr || mr.state !== 'recording') { resolve(); return; }
      const prevHandler = mr.ondataavailable;
      let done = false;
      const finish = () => { if (done) return; done = true; mr.ondataavailable = prevHandler; try { mr.pause(); } catch (e) {} resolve(); };
      mr.ondataavailable = (e) => { if (prevHandler) prevHandler(e); finish(); };
      try { mr.requestData(); } catch (e) { finish(); return; }
      setTimeout(finish, 500); // safety net if dataavailable never fires
    } catch (e) { resolve(); }
  });
  // Fully stops and releases the mic — used when the session genuinely ends
  // (Close, switching mode, another tab taking over), not on a mere pause.
  const stopAudioRecording = () => new Promise((resolve) => {
    const mr = mediaRecRef.current;
    try { streamRef.current && streamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
    streamRef.current = null;
    if (!mr || mr.state === 'inactive') { mediaRecRef.current = null; resolve(); return; }
    mr.onstop = () => { mediaRecRef.current = null; resolve(); };
    try { mr.stop(); } catch (e) { mediaRecRef.current = null; resolve(); }
  });

  // ---- autosave: upserts (by clipIdRef) the in-progress recording, so Stop,
  // closing the overlay, switching mode, or the tab closing mid-capture never
  // loses it. Cheap by default (just persists what's captured so far); pass
  // finalize:true (only from Stop/Close) to run the full acoustic analysis
  // once recording is actually done. Accepts explicit overrides so a caller
  // that's about to wipe state (fullClose) can snapshot values BEFORE the
  // wipe, instead of racing an async save against the wipe's re-render. ----
  const saveCheckpoint = React.useCallback(async (opts = {}) => {
    if (!clipIdRef.current || savingRef.current) return;
    const text = opts.textOverride != null
      ? opts.textOverride.trim()
      : capMode === 'listen'
        ? transcriptRef.current.trim()
        : (opts.exchangesOverride || exRef.current).map(e => `${e.role === 'me' ? 'You' : 'Kithra'}: ${e.text}`).join('\n\n');
    const hasAudio = chunksRef.current.length > 0;
    if (!hasAudio && !text) return; // nothing worth saving yet
    savingRef.current = true;
    try {
      const mimeType = (mediaRecRef.current && mediaRecRef.current.mimeType) || 'audio/webm';
      const blob = hasAudio ? new Blob(chunksRef.current, { type: mimeType }) : null;
      const url = blob ? URL.createObjectURL(blob) : null;
      if (lastUrlRef.current && lastUrlRef.current !== url) { try { URL.revokeObjectURL(lastUrlRef.current); } catch (e) {} }
      lastUrlRef.current = url;
      const durSec = opts.secsOverride != null ? opts.secsOverride : secsRef.current;
      let patch = {
        id: clipIdRef.current,
        name: `${capMode === 'converse' ? 'Live conversation' : 'Live capture'} — ${new Date(startedAtRef.current || Date.now()).toLocaleString()}`,
        url, durSec, source: 'listen', ts: startedAtRef.current || Date.now(),
        transcript: text || undefined,
      };
      if (opts.finalize && blob && window.analyzeAudio) {
        try {
          const res = await window.analyzeAudio(new File([blob], patch.name, { type: mimeType }));
          patch = { ...patch, durSec: res.duration, peaks: res.peaks, analysis: res };
        } catch (e) {}
      }
      addClip(patch, blob);
    } finally { savingRef.current = false; }
  }, [capMode, addClip]);

  // periodic checkpoint while live — caps data loss (crash, killed tab, dead
  // battery) to at most CHECKPOINT_MS regardless of how the session ends
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => { saveCheckpoint(); }, CHECKPOINT_MS);
    return () => clearInterval(id);
  }, [running, saveCheckpoint]);

  React.useEffect(() => () => { wantRef.current=false; busyRef.current=false; try{recRef.current&&recRef.current.stop();}catch(e){} V.stopSpeak&&V.stopSpeak(); try{streamRef.current&&streamRef.current.getTracks().forEach(t=>t.stop());}catch(e){} }, []);
  React.useEffect(() => { if (!running) return; const id=setInterval(()=>setSecs(s=>s+1),1000); return ()=>clearInterval(id); }, [running]);
  // ---- single-tab guard: only one tab may hold live capture at a time ----
  const yieldCapture = React.useCallback((msg) => {
    wantRef.current = false; busyRef.current = false;
    try { recRef.current && recRef.current.stop(); } catch (e) {}
    V.stopSpeak && V.stopSpeak();
    setRunning(false); if (msg) setErr(msg);
    stopAudioRecording().then(() => saveCheckpoint({ finalize: true })); // another tab took over — save what we had, don't lose it
  }, [saveCheckpoint]);
  React.useEffect(() => {
    setLockedElsewhere(Lock.busyElsewhere());
    return Lock.subscribe((st) => {
      setLockedElsewhere(st === 'theirs');
      // another tab took the mic while we were live → step aside cleanly
      if (st === 'theirs' && wantRef.current) yieldCapture('Live capture moved to another tab.');
    });
  }, [yieldCapture]);
  // free the lock AND autosave if the tab is closed mid-capture, so a stuck
  // lock never blocks the next tab and an accidental close doesn't lose the
  // session. This is best-effort (async work isn't guaranteed to finish
  // during unload) — the periodic checkpoint above is the real safety net,
  // capping any loss to a few seconds even if this never runs.
  React.useEffect(() => {
    const onUnload = (e) => { if (wantRef.current) { Lock.release(); saveCheckpoint(); e.preventDefault(); e.returnValue = ''; } };
    const onHide = () => { if (wantRef.current) { Lock.release(); saveCheckpoint(); } };
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('beforeunload', onUnload); window.removeEventListener('pagehide', onHide); Lock.release(); };
  }, [saveCheckpoint]);

  const fmt = (s)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  // ---- restart-failure guard ----
  // Chrome's SpeechRecognition legitimately ends and needs restarting during
  // normal continuous listening (periodic session limits, silence timeouts)
  // — the onEnd handlers below already restart it, by design. But if the mic
  // hardware fails or (for cloud-backed recognition) the network drops, it
  // can end up erroring and restarting in a tight loop FOREVER with no
  // feedback to the user, since the only error explicitly handled elsewhere
  // is 'not-allowed'. Track restarts-without-progress; give up and surface an
  // error after a few in a row, rather than spinning silently.
  const restartFailRef = React.useRef(0);
  const RESTART_FAIL_LIMIT = 5;
  const RESTART_FAIL_MIN_MS = 1500; // don't give up before the mic/recorder has had a fair chance to even start
  const noteRecognizerProgress = () => { restartFailRef.current = 0; };
  const noteRecognizerRestart = () => {
    restartFailRef.current += 1;
    const elapsed = Date.now() - (startedAtRef.current || Date.now());
    if (restartFailRef.current >= RESTART_FAIL_LIMIT && elapsed >= RESTART_FAIL_MIN_MS) {
      wantRef.current = false; busyRef.current = false;
      setRunning(false);
      setErr('Microphone stopped responding — check your mic/connection and try again.');
      pauseAudioRecording().then(() => saveCheckpoint({ finalize: true })); // don't lose what was captured before it died
      return false; // caller must not retry
    }
    return true;
  };

  const startListen = () => {
    const r = V.createRecognizer(recLang, {
      continuous:true,
      onStart:()=>setRunning(true),
      onInterim:(t)=>{ noteRecognizerProgress(); setInterim(t); },
      onFinal:(t)=>{ noteRecognizerProgress(); setInterim(''); setTranscript(p=> (p?p+' ':'')+t); },
      onEnd:()=>{ if (wantRef.current) { if (noteRecognizerRestart()) { try{r.start();}catch(e){} } } else setRunning(false); },
      onError:(e)=>{ if(e&&e.error==='not-allowed'){ setErr('Microphone permission was blocked.'); wantRef.current=false; setRunning(false);} },
    });
    if (!r){ setErr('Continuous capture is not available in this browser.'); return false; }
    recRef.current=r; try{r.start();}catch(e){} return true;
  };

  const replyTo = async (userText) => {
    busyRef.current = true; setThinking(true);
    let reply = '';
    const Cloud = window.KithraCloud, AI = window.KithraAI;
    if (Cloud && AI && AI.aiReady && AI.aiReady()) {
      try {
        const realCtx = AI.buildContext({ clips, books, mode });
        const hist = exRef.current.slice(-4).map(e=>`${e.role==='me'?'User':'Kithra'}: ${e.text}`).join('\n');
        const sys = `You are Kithra, a calm, private voice companion in a live ${mode==='business'?'work':'personal'} conversation. Ground everything in the user's REAL recordings below; never invent recordings, names or quotes. Reply in ${replyLang}, in 1–3 short, warm, spoken sentences. Plain text only.`;
        const prompt = `CONTEXT ABOUT THE USER'S REAL DATA:\n${realCtx}\n\n${hist?'RECENT TURNS:\n'+hist+'\n\n':''}The user just said: "${userText}"`;
        reply = capStripMd(await Cloud.askAI(prompt, sys) || '');
      } catch(e) {}
    }
    if (!reply) reply = mode==='business'
      ? `Got it — tell me a bit more and I’ll connect it to what I’ve heard from you before.`
      : `I hear you. Want to sit with that a moment, or unpack it a little?`;
    setThinking(false);
    setExchanges(p=>[...p,{role:'ai',text:reply}]);
    const after = () => { busyRef.current=false; if (wantRef.current) startTurn(); };
    if (voicePrefs.voiceReply && V.ttsSupported) V.speak(reply, { voiceName:voicePrefs.voice, lang:recLang, onend:after, onerror:after });
    else after();
  };
  const startTurn = () => {
    if (busyRef.current) return;
    const r = V.createRecognizer(recLang, {
      continuous:false,
      onStart:()=>setRunning(true),
      onInterim:(t)=>{ noteRecognizerProgress(); setInterim(t); },
      onFinal:(t)=>{ noteRecognizerProgress(); setInterim(''); if(t){ setExchanges(p=>[...p,{role:'me',text:t}]); replyTo(t); } },
      onEnd:()=>{ if (wantRef.current && !busyRef.current) { if (noteRecognizerRestart()) { try{startTurn();}catch(e){} } } if(!wantRef.current) setRunning(false); },
      onError:(e)=>{ if(e&&e.error==='not-allowed'){ setErr('Microphone permission was blocked.'); wantRef.current=false; setRunning(false);} },
    });
    if (!r){ setErr('Conversation mode is not available in this browser.'); return false; }
    recRef.current=r; try{r.start();}catch(e){} return true;
  };

  const beginCapture = () => {
    setErr('');
    V.stopSpeak && V.stopSpeak();
    wantRef.current = true; busyRef.current = false;
    restartFailRef.current = 0;
    // a fresh clip id per session; RETAINED across stop()->start() (resume,
    // e.g. hitting pause then continuing) so that continues the same
    // recording rather than forking a new one — only fullClose()/switchMode()
    // clear it, since those genuinely end this recording.
    if (!clipIdRef.current) { clipIdRef.current = 'live-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8); startedAtRef.current = Date.now(); }
    startAudioRecording();
    if (capMode==='listen') startListen(); else startTurn();
  };
  const start = () => {
    setErr('');
    if (!V.sttSupported) { setErr('Live capture needs Chrome or Edge with microphone access. The native app handles this in the background.'); return; }
    // Same one-time reminder as Analyze's recording flow (shared localStorage
    // flag) — recording other people needs their informed consent (DPDP Act
    // and similar laws elsewhere). Legal promises this reminder site-wide.
    let acked = false; try { acked = localStorage.getItem('kithra_rec_ack') === '1'; } catch (e) {}
    if (!acked) { setShowRecNotice(true); return; }
    if (!Lock.claim({ mode: capMode })) { setLockedElsewhere(true); return; } // another tab already owns live capture
    setLockedElsewhere(false);
    beginCapture();
  };
  const ackAndStart = () => {
    try { localStorage.setItem('kithra_rec_ack', '1'); } catch (e) {}
    setShowRecNotice(false);
    if (!Lock.claim({ mode: capMode })) { setLockedElsewhere(true); return; }
    setLockedElsewhere(false);
    beginCapture();
  };
  const takeOverHere = () => { Lock.takeover({ mode: capMode }); setLockedElsewhere(false); beginCapture(); };
  // Stop AUTOSAVES what was captured (audio + transcript) as a real recording
  // — this is the fix: ending a session, however it happens, must never
  // silently discard it. PAUSES the recorder (not a full release) so a
  // later Resume keeps appending to the SAME clip — the pill already labels
  // this Pause/Resume, so a naive full-stop-and-restart here would silently
  // drop everything captured before the pause the next time it's finalized.
  // Snapshots text/secs SYNCHRONOUSLY (before returning) so a caller that
  // immediately wipes state afterward (switchMode, fullClose) can never race
  // the async save into persisting empty content. Returns the save's promise
  // so those callers know when it's SAFE to fully release the mic and clear
  // chunksRef/clipIdRef — doing that any earlier would empty the buffer the
  // save is about to read from.
  const stop = () => {
    const snap = { textOverride: capMode==='listen' ? transcript : exchanges.map(e => `${e.role==='me'?'You':'Kithra'}: ${e.text}`).join('\n\n'), secsOverride: secs };
    wantRef.current=false; busyRef.current=false;
    try{recRef.current&&recRef.current.stop();}catch(e){}
    V.stopSpeak&&V.stopSpeak();
    setRunning(false); Lock.release();
    return pauseAudioRecording().then(() => saveCheckpoint({ finalize: true, ...snap }));
  };
  const switchMode = (m) => {
    if (m===capMode) return;
    // pause+checkpoint the outgoing mode's recording first, THEN fully
    // release the mic and clear refs — Listen and Conversation are different
    // recordings, so (unlike a plain Stop) this genuinely ends this one.
    stop().then(() => stopAudioRecording()).then(() => {
      clipIdRef.current = null; chunksRef.current = [];
      if (lastUrlRef.current) { try { URL.revokeObjectURL(lastUrlRef.current); } catch (e) {} lastUrlRef.current = null; }
    });
    setCapMode(m);
    setSecs(0); setTranscript(''); setExchanges([]); setInterim('');
  };
  const fullClose = () => {
    stop().then(() => stopAudioRecording()).then(() => {
      clipIdRef.current = null; chunksRef.current = [];
      if (lastUrlRef.current) { try { URL.revokeObjectURL(lastUrlRef.current); } catch (e) {} lastUrlRef.current = null; }
    });
    setSecs(0); setTranscript(''); setExchanges([]); setInterim('');
    closeCapture();
  };
  const goBackground = () => { setAskBg(false); minimizeCapture(); };
  // device / meeting audio capture is owned by the Analyze screen; route to it
  const startDeviceCapture = () => { try { window.KithraAutoSysCapture = true; } catch(e){} fullClose(); go('analyze'); };

  const statusText = running ? (capMode==='converse'?'In conversation':'Listening') : 'Paused';
  const turns = exchanges.filter(e=>e.role==='me').length;

  // ---- minimized floating pill ----
  if (capture.minimized) {
    return (
      <div className="lc-pill" role="status">
        <button className="lc-pill-main" onClick={expandCapture} title="Open Kithra capture">
          <span className="lc-pill-ic"><LumenMark size={22} /></span>
          <span className="stack" style={{ gap:1, alignItems:'flex-start', minWidth:0 }}>
            <span className="lc-pill-title">Kithra <span className="lc-notif-dot" data-on={running?'1':'0'} /> {statusText}</span>
            <span className="lc-pill-sub tnum">{fmt(secs)} · {capMode==='converse'?`${turns} turns`:`${words} words`}</span>
          </span>
          {running && <span className="lc-pill-wave"><LiveWave bars={9} height={20} color="var(--accent)" /></span>}
        </button>
        <div className="lc-pill-actions">
          {running
            ? <button onClick={stop} title="Pause" aria-label="Pause"><Icon name="pause" size={15} /></button>
            : <button onClick={start} title="Resume" aria-label="Resume"><Icon name="play" size={15} fill /></button>}
          <button onClick={fullClose} title="End" aria-label="End"><Icon name="x" size={15} /></button>
        </div>
      </div>
    );
  }

  if (!capture.open) return null;

  return (
    <div className="lc-overlay" onMouseDown={(e)=>{ if(e.target===e.currentTarget){ if(running) setAskBg(true); else fullClose(); } }}>
      <div className="lc-card card">
        <div className="row" style={{ justifyContent:'space-between', marginBottom:10 }}>
          <span className="badge badge-accent" style={{ height:26, whiteSpace:'nowrap' }}><Icon name="mic" size={13} />Always-on{mode==='personal'?' · personal':''}</span>
          <div className="row" style={{ gap:6 }}>
            <button className="btn btn-icon btn-ghost btn-sm" onClick={()=> running ? setAskBg(true) : minimizeCapture()} aria-label="Minimize" title="Keep running in background"><Icon name="chevD" size={16} /></button>
            <button className="btn btn-icon btn-ghost btn-sm" onClick={fullClose} aria-label="Close"><Icon name="x" size={16} /></button>
          </div>
        </div>

        <div className="lc-modes">
          <button className={capMode==='listen'?'on':''} onClick={()=>switchMode('listen')}>
            <Icon name="wave" size={16} /><span className="stack" style={{ gap:1, alignItems:'flex-start' }}><b>Listen mode</b><i>Captures everything</i></span>
          </button>
          <button className={capMode==='converse'?'on':''} onClick={()=>switchMode('converse')}>
            <Icon name="chat" size={16} /><span className="stack" style={{ gap:1, alignItems:'flex-start' }}><b>Conversation</b><i>Talk back &amp; forth</i></span>
          </button>
        </div>

        <div className="lc-ctx">
          <span className="center" style={{ width:30, height:30, borderRadius:9, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name="layers" size={16} /></span>
          <div className="stack grow" style={{ gap:2, minWidth:0 }}>
            <span style={{ fontWeight:650, fontSize:13 }}>Using your history for context</span>
            <span className="faint" style={{ fontSize:11.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Kithra draws on what you’ve shared before to understand you better</span>
          </div>
          <span className="badge badge-good" style={{ flex:'none' }}>linked</span>
        </div>

        <div className="lc-notif">
          <span className="lc-notif-ic"><LumenMark size={22} /></span>
          <div className="stack grow" style={{ gap:1, minWidth:0 }}>
            <span className="lc-notif-title">Kithra <span className="lc-notif-dot" data-on={running?'1':'0'} /> <span className="lc-notif-status">{statusText}</span></span>
            <span className="lc-notif-sub">{running?'Running quietly · tap to open':'Background capture · nothing else on screen'}</span>
          </div>
          <span className="faint" style={{ fontSize:11, flex:'none' }}>now</span>
        </div>
        <p className="faint" style={{ fontSize:11.5, textAlign:'center', margin:'8px 0 2px' }}>All your phone shows while it runs — a quiet status, just the Kithra logo.</p>
        <div className="row" style={{ gap:8, justifyContent:'center', marginTop:8, flexWrap:'wrap' }}>
          <span className="badge badge-good"><Icon name="lock" size={12} />Records with phone locked</span>
          <span className="badge badge-good"><Icon name="refresh" size={12} />Records when screen is off</span>
        </div>

        <div className="lc-stage" style={{ marginTop:14 }}>
          <div className={`lc-orb ${running?'on':''}`}>
            {running ? <LiveWave bars={26} height={52} color="var(--accent)" /> : <Icon name={capMode==='converse'?'chat':'mic'} size={28} />}
          </div>
          <div className="row" style={{ gap:18, marginTop:12, justifyContent:'center' }}>
            <div className="stack center" style={{ gap:2 }}><span className="metric-num" style={{ fontSize:19 }}>{fmt(secs)}</span><span className="faint" style={{ fontSize:11 }}>elapsed</span></div>
            <div className="stack center" style={{ gap:2 }}><span className="metric-num" style={{ fontSize:19 }}>{capMode==='converse'?turns:words}</span><span className="faint" style={{ fontSize:11 }}>{capMode==='converse'?'turns':'words'}</span></div>
            <div className="stack center" style={{ gap:2 }}><span className="metric-num" style={{ fontSize:19, color:running?'var(--good)':'var(--ink-3)' }}>{running?'Live':'Idle'}</span><span className="faint" style={{ fontSize:11 }}>status</span></div>
          </div>
        </div>

        {err && <div className="voice-err" style={{ marginTop:12 }}><Icon name="lock" size={13} />{err}</div>}

        {capMode==='listen' ? (
          (transcript || interim) && (
            <div ref={feedRef} className="lc-transcript scroll">{transcript} <span className="faint" style={{ fontStyle:'italic' }}>{interim}</span></div>
          )
        ) : (
          (exchanges.length>0 || interim || thinking) && (
            <div ref={feedRef} className="lc-feed scroll">
              {exchanges.map((e,i)=>(<div key={i} className={`lc-msg ${e.role}`}>{e.text}</div>))}
              {interim && <div className="lc-msg me interim">{interim}</div>}
              {thinking && <div className="lc-msg ai"><span className="dots"><span/><span/><span/></span></div>}
            </div>
          )
        )}

        {lockedElsewhere && !running && (
          <div className="lc-elsewhere" role="status" style={{ display:'flex', alignItems:'center', gap:10, marginTop:14, padding:'11px 13px', borderRadius:12, background:'var(--accent-soft)', color:'var(--accent-strong)', fontSize:13, lineHeight:1.45 }}>
            <Icon name="mic" size={16} />
            <span className="grow">Live capture is running in <b>another tab</b>. Only one tab listens at a time, so your audio is never split or duplicated.</span>
          </div>
        )}

        <div className="row" style={{ gap:10, marginTop:16 }}>
          {running
            ? <button className="btn btn-lg grow" style={{ background:'var(--bad)', color:'#fff' }} onClick={stop}><Icon name="pause" size={18} />Stop</button>
            : lockedElsewhere
              ? <button className="btn btn-primary btn-lg grow" onClick={takeOverHere}><Icon name="refresh" size={18} />Take over capture here</button>
              : <button className="btn btn-primary btn-lg grow" onClick={start}><Icon name={capMode==='converse'?'chat':'mic'} size={18} />{capMode==='converse'?'Start talking':'Start listening'}</button>}
          {running
            ? <button className="btn btn-soft btn-lg" onClick={()=>setAskBg(true)} title="Keep running in background"><Icon name="chevD" size={17} />Background</button>
            : <button className="btn btn-soft btn-lg" disabled={!transcript && exchanges.length===0} onClick={()=>{ fullClose(); go('analyze'); }} title="Analyze captured audio"><Icon name="trend" size={17} />Analyze</button>}
        </div>

        {nativeCap && !running && (
          <button className="btn btn-soft btn-lg" style={{ width:'100%', marginTop:10 }} onClick={startDeviceCapture}>
            <Icon name="layers" size={17} />Capture device / meeting audio
          </button>
        )}

        <div className="disclaimer" style={{ marginTop:16 }}>
          <span className="center" style={{ width:34, height:34, borderRadius:10, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name="lock" size={17} /></span>
          <div className="stack" style={{ gap:2 }}>
            <span style={{ fontWeight:650, fontSize:13.5 }}>Background mode lives in the Kithra mobile app</span>
            <span className="faint" style={{ fontSize:12.5, lineHeight:1.5 }}>On iOS/Android your chosen mode keeps recording even when your phone is locked or the screen is off — shown only as a small Kithra logo in your notification bar. Everything stays encrypted, checkpoints every 12 seconds, and you can pause or revoke it anytime.</span>
          </div>
        </div>
      </div>

      {/* one-time reminder: recording other people needs their consent */}
      {showRecNotice && (
        <div className="lc-confirm" onMouseDown={(e)=>{ if(e.target===e.currentTarget) setShowRecNotice(false); }}>
          <div className="lc-confirm-card card">
            <span className="center" style={{ width:52, height:52, borderRadius:16, background:'var(--accent-soft)', color:'var(--accent-strong)', margin:'0 auto 12px' }}><Icon name="shield" size={24} /></span>
            <h3 className="display" style={{ fontSize:21, margin:'0 0 6px', textAlign:'center' }}>Before you record</h3>
            <p className="muted" style={{ margin:'0 0 16px', fontSize:13.5, lineHeight:1.55, textAlign:'center' }}>
              Voice is personal data. If this recording will include <strong>other people</strong>, the law in India (DPDP Act) and many other places requires their <strong>informed consent</strong> first. Recording just yourself? You’re good to go.
            </p>
            <div className="row" style={{ gap:10 }}>
              <button className="btn btn-ghost btn-lg grow" onClick={()=>setShowRecNotice(false)}>Cancel</button>
              <button className="btn btn-primary btn-lg grow" onClick={ackAndStart}><Icon name="check" size={17} />I understand — start</button>
            </div>
            <button className="linkbtn" style={{ fontSize:12, display:'block', margin:'12px auto 0' }} onClick={()=>{ setShowRecNotice(false); fullClose(); go('legal'); }}>Read the recording policy</button>
          </div>
        </div>
      )}

      {/* permission ask before going background */}
      {askBg && (
        <div className="lc-confirm" onMouseDown={(e)=>{ if(e.target===e.currentTarget) setAskBg(false); }}>
          <div className="lc-confirm-card card">
            <span className="center" style={{ width:52, height:52, borderRadius:16, background:'var(--accent-soft)', color:'var(--accent-strong)', margin:'0 auto 12px' }}><Icon name="mic" size={24} /></span>
            <h3 className="display" style={{ fontSize:21, margin:'0 0 6px', textAlign:'center' }}>Keep Kithra listening in the background?</h3>
            <p className="muted" style={{ margin:'0 0 16px', fontSize:13.5, lineHeight:1.55, textAlign:'center' }}>
              {capMode==='converse'?'Your conversation':'Listening'} keeps running while you use the rest of the app. You’ll see a small Kithra indicator the whole time — and can pause or end it anytime.
            </p>
            <div className="stack" style={{ gap:9, marginBottom:16 }}>
              {[['mic','Microphone access while in use'],['lock','Encrypted, never used to train shared models'],['layers','Builds on your prior recordings for context']].map((x,i)=>(
                <div key={i} className="row" style={{ gap:10 }}>
                  <span className="center" style={{ width:26, height:26, borderRadius:8, background:'var(--good-soft)', color:'var(--good)', flex:'none' }}><Icon name={x[0]} size={14} /></span>
                  <span style={{ fontSize:13 }}>{x[1]}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap:10 }}>
              <button className="btn btn-ghost btn-lg grow" onClick={()=>setAskBg(false)}>Not now</button>
              <button className="btn btn-primary btn-lg grow" onClick={goBackground}><Icon name="check" size={17} />Allow & minimize</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { LiveCaptureHost, lumenContext });


export { LiveCaptureHost, lumenContext };
