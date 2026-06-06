import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   LUMEN — Ask Kithra + voice agent (talk, real voices, accents)
   Live Capture now lives app-level in screens-capture.jsx.
   ============================================================ */
function renderBold(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p,i)=> p.startsWith('**') && p.endsWith('**')
    ? <strong key={i} style={{ fontWeight:700, color:'var(--ink)' }}>{p.slice(2,-2)}</strong>
    : <React.Fragment key={i}>{p}</React.Fragment>);
}
const stripMd = (s) => String(s).replace(/\*\*/g,'').replace(/[*_`#>]/g,'').trim();

function MiniChart({ kind, mode }) {
  const data = window.LUMEN[mode];
  if (kind === 'objections') return <HBars items={data.objections.slice(0,4)} showTrend accent="var(--viz-3)" />;
  if (kind === 'patterns') return (
    <div className="stack" style={{ gap:8 }}>
      {data.winPatterns.slice(0,3).map((p,i)=>(
        <div key={i} className="row" style={{ justifyContent:'space-between', gap:10 }}>
          <span style={{ fontSize:13, fontWeight:600 }}>{p.t}</span><span className="badge badge-good">{p.lift}</span>
        </div>
      ))}
    </div>
  );
  if (kind === 'emotion') return <LineChart series={[{ color:'var(--accent)', data:data.sentimentTrend }]} height={120} yMin={0} yMax={0.45} labels={['','','','','','Now']} />;
  return null;
}

const ASK_LANGS = [
  { value:'auto',  label:'Auto-detect', rec:(navigator.language||'en-US'), reply:'the user’s language' },
  { value:'en-US', label:'English',     rec:'en-US', reply:'English' },
  { value:'es-ES', label:'Español',     rec:'es-ES', reply:'Spanish' },
  { value:'hi-IN', label:'हिन्दी',       rec:'hi-IN', reply:'Hindi' },
  { value:'fr-FR', label:'Français',    rec:'fr-FR', reply:'French' },
  { value:'de-DE', label:'Deutsch',     rec:'de-DE', reply:'German' },
  { value:'pt-BR', label:'Português',   rec:'pt-BR', reply:'Portuguese' },
];

function AskKithra() {
  const { mode, go, voicePrefs, setVoice, openCapture } = useApp();
  const cfg = window.LUMEN.ask[mode];
  const V = window.LumenVoice || {};
  const [msgs, setMsgs] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [typing, setTyping] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState('');
  const [speaking, setSpeaking] = React.useState(false);
  const [voiceErr, setVoiceErr] = React.useState('');
  const [voiceOpts, setVoiceOpts] = React.useState([{ value:'', label:'Auto · natural' }]);
  const scrollRef = React.useRef(null);
  const recRef = React.useRef(null);

  const curLang = ASK_LANGS.find(l => l.value === voicePrefs.lang) || ASK_LANGS[0];

  // build the voice list from the device's REAL voices (loads async)
  React.useEffect(() => {
    const build = () => {
      const vs = (V.listVoices && V.listVoices()) || [];
      setVoiceOpts([{ value:'', label:'Auto · natural' }, ...vs.map(v => ({ value:v.uri, label:v.label }))]);
    };
    build();
    const ss = window.speechSynthesis;
    if (ss && ss.addEventListener) { ss.addEventListener('voiceschanged', build); }
    const t = setTimeout(build, 700);
    return () => { if (ss && ss.removeEventListener) ss.removeEventListener('voiceschanged', build); clearTimeout(t); };
  }, []);

  React.useEffect(() => { setMsgs([]); setInput(''); }, [mode]);
  React.useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, typing, interim]);
  React.useEffect(() => () => { try { recRef.current && recRef.current.stop(); } catch(e){} V.stopSpeak && V.stopSpeak(); }, []);

  const speakAnswer = (text) => {
    if (!voicePrefs.voiceReply || !V.ttsSupported || !text) return;
    V.speak(stripMd(text), { voiceName:voicePrefs.voice, lang:curLang.rec, onstart:()=>setSpeaking(true), onend:()=>setSpeaking(false), onerror:()=>setSpeaking(false) });
  };
  const pushAI = (ans) => { setMsgs(m => [...m, { role:'ai', ...ans }]); speakAnswer(ans.text); };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q) return;
    V.stopSpeak && V.stopSpeak(); setSpeaking(false);
    setMsgs(m => [...m, { role:'me', text:q }]);
    setInput(''); setInterim(''); setTyping(true);

    const canned = cfg.answers[q];
    if (canned) { await new Promise(r=>setTimeout(r,850)); setTyping(false); pushAI(canned); return; }

    if (window.claude && typeof window.claude.complete === 'function') {
      try {
        const sys = `You are Kithra, a calm, private voice agent for conversation intelligence. The user is in ${mode} mode (${mode==='business'?'sales & work':'personal reflection & well-being'}). Reply in 2–4 short, warm, spoken-friendly sentences. ${mode==='personal'?'Be gentle and supportive, evidence-informed, never clinical.':'Be practical and concrete, like a sharp sales coach.'} Reply in ${curLang.reply}. Plain text only, no markdown. The user asked: "${q}"`;
        const out = await window.claude.complete(sys);
        const clean = stripMd(out || '') || cfg.answers.default.text;
        setTyping(false); pushAI({ text:clean });
      } catch (e) { setTyping(false); pushAI(cfg.answers.default); }
    } else { await new Promise(r=>setTimeout(r,950)); setTyping(false); pushAI(cfg.answers.default); }
  };

  const toggleMic = () => {
    setVoiceErr('');
    if (!V.sttSupported) { setVoiceErr('Voice input needs Chrome or Edge with microphone access. You can still type.'); return; }
    if (listening) { try { recRef.current && recRef.current.stop(); } catch(e){} return; }
    V.stopSpeak && V.stopSpeak(); setSpeaking(false);
    const r = V.createRecognizer(curLang.rec, {
      onStart:()=>setListening(true),
      onInterim:(t)=>setInterim(t),
      onFinal:(t)=>{ setInterim(''); if(t) send(t); },
      onEnd:()=>{ setListening(false); setInterim(''); },
      onError:(e)=>{ setListening(false); setInterim(''); if(e && e.error==='not-allowed') setVoiceErr('Microphone permission was blocked. Allow mic access to talk to Kithra.'); },
    });
    if (!r) { setVoiceErr('Voice input is not available in this browser.'); return; }
    recRef.current = r; try { r.start(); } catch(e){}
  };
  const stopSpeaking = () => { V.stopSpeak && V.stopSpeak(); setSpeaking(false); };
  const onPickVoice = (v) => { setVoice({ voice:v }); setVoiceErr(''); if (V.preview) try { V.preview(v, curLang.rec); } catch(e){} };

  const empty = msgs.length === 0 && !typing;

  return (
    <div className="ask-wrap">
      {/* voice toolbar */}
      <div className="voice-bar">
        <div className="row" style={{ gap:8, flexWrap:'wrap' }}>
          <Dropdown icon="chat" label="Language" value={voicePrefs.lang} options={ASK_LANGS} onChange={(v)=>setVoice({lang:v})} />
          <Dropdown icon="mic" label="Voice" value={voicePrefs.voice} options={voiceOpts} onChange={onPickVoice} />
        </div>
        <div className="grow" />
        <span className="vchip ghost" title="In production, Kithra’s voice agent runs on Google Gemini"><Icon name="bolt" size={14} />Gemini</span>
        <button className={`vchip ${voicePrefs.voiceReply?'on':''}`} onClick={()=>{ if(voicePrefs.voiceReply) stopSpeaking(); setVoice({voiceReply:!voicePrefs.voiceReply}); }} title="Speak answers aloud">
          <Icon name={voicePrefs.voiceReply?'wave':'pause'} size={15} />{voicePrefs.voiceReply?'Voice on':'Voice off'}
        </button>
        <button className="vchip" onClick={()=>openCapture()} title="Always-on listening">
          <Icon name="mic" size={15} />Live capture
        </button>
      </div>

      <div ref={scrollRef} className="ask-msgs scroll" style={{ overflowY:'auto' }}>
        {empty && (
          <div className="center anim-up" style={{ flex:1, textAlign:'center', padding:'20px 0' }}>
            <div className="stack center" style={{ gap:16, maxWidth:480 }}>
              <button className="talk-orb" onClick={toggleMic} aria-label="Talk to Kithra">
                <span className="talk-orb-glow" />
                <Icon name="mic" size={30} />
              </button>
              <div className="stack" style={{ gap:8 }}>
                <h2 className="display" style={{ fontSize:26, margin:0 }}>Talk to Kithra, or type</h2>
                <p className="muted" style={{ margin:0, fontSize:14.5, lineHeight:1.55 }}>
                  {mode==='business'
                    ? 'Ask out loud or in writing — Kithra answers across your calls, cites the moments, and can reply in your language and accent.'
                    : 'Speak naturally or type. Kithra reflects on your patterns, points to the moments, and can talk back in your language and voice.'}
                </p>
              </div>
              <PrivacyChip text="Voice & answers stay in your workspace" />
            </div>
          </div>
        )}

        {msgs.map((m,i)=>(
          <div key={i} className={`ask-row ${m.role==='me'?'me':''} anim-up`}>
            {m.role==='ai'
              ? <span className="ask-av" style={{ background:'var(--accent)', color:'var(--accent-ink)' }}><Icon name="spark" size={17} /></span>
              : <Avatar label="DR" color="var(--viz-1)" size={34} />}
            <div className={`ask-bubble ${m.role==='me'?'me':'ai'}`}>
              {m.role==='ai' && i===msgs.length-1 && speaking && (
                <div className="row" style={{ gap:8, marginBottom:8, color:'var(--accent-strong)' }}>
                  <span className="speak-eq"><i /><i /><i /><i /></span>
                  <span style={{ fontSize:11.5, fontWeight:600 }}>Speaking…</span>
                  <button className="linkbtn" style={{ fontSize:11.5 }} onClick={stopSpeaking}>stop</button>
                </div>
              )}
              <div>{renderBold(m.text)}</div>
              {m.chart && <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--line)' }}><MiniChart kind={m.chart} mode={mode} /></div>}
              {m.cites && (
                <div style={{ marginTop:12 }}>
                  <span className="eyebrow" style={{ display:'block', marginBottom:8 }}>Cited from your recordings</span>
                  <div className="stack" style={{ gap:7 }}>
                    {m.cites.map((c,j)=>(
                      <div key={j} className="ask-cite" onClick={()=>go('conversation')}>
                        <span className="center" style={{ width:30, height:22, flex:'none' }}><Waveform bars={9} seed={j+2} height={20} gap={2} color="var(--accent)" /></span>
                        <span className="grow" style={{ fontSize:12.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.c}</span>
                        <span className="tag" style={{ height:22, fontSize:11 }}><Icon name="clock" size={12} />{c.m}</span>
                        <Icon name="chevR" size={15} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {m.informedBy && (
                <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--line)' }}>
                  <EvidenceList items={m.informedBy} label="Cross-referenced with" />
                </div>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div className="ask-row anim-in">
            <span className="ask-av" style={{ background:'var(--accent)', color:'var(--accent-ink)' }}><Icon name="spark" size={17} /></span>
            <div className="ask-bubble ai"><span className="dots"><span /><span /><span /></span></div>
          </div>
        )}
      </div>

      <div className="ask-composer">
        {voiceErr && <div className="voice-err"><Icon name="lock" size={13} />{voiceErr}</div>}
        {listening && (
          <div className="listening-banner">
            <span className="row" style={{ gap:10, alignItems:'center' }}>
              <span className="listen-pulse"><i /></span>
              <span style={{ fontWeight:600, fontSize:13 }}>Listening{interim?'…':' — go ahead'}</span>
            </span>
            <span className="grow faint" style={{ fontSize:13, fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{interim}</span>
            <button className="linkbtn" onClick={toggleMic}>stop</button>
          </div>
        )}
        {empty && !listening && (
          <div className="ask-sugg">
            {cfg.suggestions.map((s,i)=>(
              <button key={i} className="chip" onClick={()=>send(s)}>{s}</button>
            ))}
          </div>
        )}
        <div className="ask-input">
          <button className={`mic-btn ${listening?'live':''}`} onClick={toggleMic} aria-label="Talk to Kithra" title="Hold a conversation by voice">
            <Icon name="mic" size={19} />
          </button>
          <textarea rows={1} placeholder={listening?'Listening…':(mode==='business'?'Ask about objections, deals, sentiment…':'Ask about your habits, tone, moments…')}
            value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }} />
          <button className="btn btn-icon btn-primary" style={{ width:42, height:42 }} onClick={()=>send()} aria-label="Send"><Icon name="send" size={18} /></button>
        </div>
        <div className="center" style={{ marginTop:8 }}><span className="faint" style={{ fontSize:11.5 }}>Speech is processed on-device · agent powered by Gemini in production · answers cite your recordings</span></div>
      </div>
    </div>
  );
}

Object.assign(window, { AskKithra });


export { AskKithra };
