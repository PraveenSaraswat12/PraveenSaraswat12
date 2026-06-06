import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
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
  const { capture, closeCapture, minimizeCapture, expandCapture, setCapMode, mode, voicePrefs, go } = useApp();
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
  const recRef = React.useRef(null);
  const wantRef = React.useRef(false);
  const busyRef = React.useRef(false);
  const exRef = React.useRef([]); exRef.current = exchanges;
  const feedRef = React.useRef(null);

  React.useEffect(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; }, [exchanges, transcript, interim, thinking]);
  React.useEffect(() => () => { wantRef.current=false; busyRef.current=false; try{recRef.current&&recRef.current.stop();}catch(e){} V.stopSpeak&&V.stopSpeak(); }, []);
  React.useEffect(() => { if (!running) return; const id=setInterval(()=>setSecs(s=>s+1),1000); return ()=>clearInterval(id); }, [running]);

  const fmt = (s)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  const startListen = () => {
    const r = V.createRecognizer(recLang, {
      continuous:true,
      onStart:()=>setRunning(true),
      onInterim:(t)=>setInterim(t),
      onFinal:(t)=>{ setInterim(''); setTranscript(p=> (p?p+' ':'')+t); },
      onEnd:()=>{ if (wantRef.current) { try{r.start();}catch(e){} } else setRunning(false); },
      onError:(e)=>{ if(e&&e.error==='not-allowed'){ setErr('Microphone permission was blocked.'); wantRef.current=false; setRunning(false);} },
    });
    if (!r){ setErr('Continuous capture is not available in this browser.'); return false; }
    recRef.current=r; try{r.start();}catch(e){} return true;
  };

  const replyTo = async (userText) => {
    busyRef.current = true; setThinking(true);
    let reply = '';
    if (window.claude && typeof window.claude.complete === 'function') {
      try {
        const hist = exRef.current.slice(-4).map(e=>`${e.role==='me'?'User':'Kithra'}: ${e.text}`).join('\n');
        const sys = `You are Kithra, a calm, private voice companion in a live ${mode==='business'?'work':'personal'} conversation. Use the user's history for continuity and reference it naturally when relevant. CONTEXT: ${ctx.blurb}\n${hist?'RECENT TURNS:\n'+hist+'\n':''}Reply in ${replyLang}, in 1–3 short, warm, spoken sentences. Plain text only. User just said: "${userText}"`;
        reply = capStripMd(await window.claude.complete(sys) || '');
      } catch(e) {}
    }
    if (!reply) reply = mode==='business'
      ? `Got it. That connects to what I heard in ${ctx.titles[0]} — want me to pull the thread together?`
      : `I hear you. That echoes a pattern from your recent reflections — want to sit with it a moment?`;
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
      onInterim:(t)=>setInterim(t),
      onFinal:(t)=>{ setInterim(''); if(t){ setExchanges(p=>[...p,{role:'me',text:t}]); replyTo(t); } },
      onEnd:()=>{ if (wantRef.current && !busyRef.current) { try{startTurn();}catch(e){} } if(!wantRef.current) setRunning(false); },
      onError:(e)=>{ if(e&&e.error==='not-allowed'){ setErr('Microphone permission was blocked.'); wantRef.current=false; setRunning(false);} },
    });
    if (!r){ setErr('Conversation mode is not available in this browser.'); return false; }
    recRef.current=r; try{r.start();}catch(e){} return true;
  };

  const start = () => {
    setErr('');
    if (!V.sttSupported) { setErr('Live capture needs Chrome or Edge with microphone access. The native app handles this in the background.'); return; }
    V.stopSpeak && V.stopSpeak();
    wantRef.current = true; busyRef.current = false;
    if (capMode==='listen') startListen(); else startTurn();
  };
  const stop = () => { wantRef.current=false; busyRef.current=false; try{recRef.current&&recRef.current.stop();}catch(e){} V.stopSpeak&&V.stopSpeak(); setRunning(false); };
  const switchMode = (m) => { if (m===capMode) return; stop(); setCapMode(m); setSecs(0); };
  const fullClose = () => { stop(); setSecs(0); setTranscript(''); setExchanges([]); setInterim(''); closeCapture(); };
  const goBackground = () => { setAskBg(false); minimizeCapture(); };

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

        <div className="row" style={{ gap:10, marginTop:16 }}>
          {!running
            ? <button className="btn btn-primary btn-lg grow" onClick={start}><Icon name={capMode==='converse'?'chat':'mic'} size={18} />{capMode==='converse'?'Start talking':'Start listening'}</button>
            : <button className="btn btn-lg grow" style={{ background:'var(--bad)', color:'#fff' }} onClick={stop}><Icon name="pause" size={18} />Stop</button>}
          {running
            ? <button className="btn btn-soft btn-lg" onClick={()=>setAskBg(true)} title="Keep running in background"><Icon name="chevD" size={17} />Background</button>
            : <button className="btn btn-soft btn-lg" disabled={!transcript && exchanges.length===0} onClick={()=>{ stop(); closeCapture(); go('analyze'); }} title="Analyze captured audio"><Icon name="trend" size={17} />Analyze</button>}
        </div>

        <div className="disclaimer" style={{ marginTop:16 }}>
          <span className="center" style={{ width:34, height:34, borderRadius:10, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name="lock" size={17} /></span>
          <div className="stack" style={{ gap:2 }}>
            <span style={{ fontWeight:650, fontSize:13.5 }}>Background mode lives in the Kithra mobile app</span>
            <span className="faint" style={{ fontSize:12.5, lineHeight:1.5 }}>On iOS/Android your chosen mode keeps recording even when your phone is locked or the screen is off — shown only as a small Kithra logo in your notification bar. Everything stays encrypted, backs up every 15 minutes, and you can pause or revoke it anytime.</span>
          </div>
        </div>
      </div>

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
