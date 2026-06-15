import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import { askKithra, aiReady } from './ai.js';
/* ============================================================
   KITHRA — Ask: a REAL agent over YOUR recordings & books
   Every answer is grounded in actual clips, transcripts and
   metrics via Gemini. Voice in/out via Web Speech.
   ============================================================ */
const ASK_LANGS = [
  { value:'auto',  label:'Auto', rec:(navigator.language||'en-US'), reply:'auto' },
  { value:'en-US', label:'English', rec:'en-US', reply:'English' },
  { value:'hi-IN', label:'हिन्दी', rec:'hi-IN', reply:'Hindi' },
  { value:'es-ES', label:'Español', rec:'es-ES', reply:'Spanish' },
  { value:'fr-FR', label:'Français', rec:'fr-FR', reply:'French' },
  { value:'de-DE', label:'Deutsch', rec:'de-DE', reply:'German' },
];
const fmtDur = (s)=>`${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,'0')}`;

function AskKithra() {
  const { mode, go, voicePrefs, setVoice, clips, books, askFocus, setAskFocus, hasConsent, grantConsent } = useApp();
  const V = window.LumenVoice || {};
  const [msgs, setMsgs] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [typing, setTyping] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState('');
  const [speaking, setSpeaking] = React.useState(false);
  const [voiceErr, setVoiceErr] = React.useState('');
  const [needConsent, setNeedConsent] = React.useState(false);
  const scrollRef = React.useRef(null);
  const recRef = React.useRef(null);
  const curLang = ASK_LANGS.find(l => l.value === voicePrefs.lang) || ASK_LANGS[0];
  const ready = aiReady();
  const transcribed = (clips||[]).filter(c=>c.transcript).length;

  React.useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, typing, interim]);
  React.useEffect(() => () => { try { recRef.current && recRef.current.stop(); } catch(e){} V.stopSpeak && V.stopSpeak(); }, []);

  const speakAnswer = (text) => {
    if (!voicePrefs.voiceReply || !V.ttsSupported || !text) return;
    V.speak(text, { voiceName:voicePrefs.voice, lang:curLang.rec, onstart:()=>setSpeaking(true), onend:()=>setSpeaking(false), onerror:()=>setSpeaking(false) });
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || typing) return;
    V.stopSpeak && V.stopSpeak(); setSpeaking(false);
    if (!ready) { setMsgs(m=>[...m, { role:'me', text:q }, { role:'ai', text:'I’m not connected to the cloud on this build, so I can’t reason over your recordings yet. Open Privacy & Data → Cloud & account to connect — or use the on-device analysis on the Analyze page.' }]); setInput(''); return; }
    if (!hasConsent('cloud_ai')) { setNeedConsent(true); setInput(q); return; }
    setMsgs(m => [...m, { role:'me', text:q }]);
    setInput(''); setInterim(''); setTyping(true);
    try {
      const history = msgs.slice(-6);
      const out = await askKithra({ question:q, mode, clips, books, focus:askFocus, history, language: curLang.reply==='auto'?null:curLang.reply });
      setTyping(false);
      const ans = (out||'').trim() || 'I came back empty — try asking that another way.';
      setMsgs(m => [...m, { role:'ai', text:ans }]);
      speakAnswer(ans);
    } catch(e) {
      setTyping(false);
      setMsgs(m => [...m, { role:'ai', text:'I couldn’t reach the AI just now ('+((e&&e.message)||'network')+'). Give it a second and try again.' }]);
    }
  };

  const allowAndSend = () => { grantConsent('cloud_ai'); setNeedConsent(false); send(); };

  const toggleMic = () => {
    setVoiceErr('');
    if (!V.sttSupported) { setVoiceErr('Voice input needs Chrome/Edge with mic access — typing works everywhere.'); return; }
    if (listening) { try { recRef.current && recRef.current.stop(); } catch(e){} return; }
    V.stopSpeak && V.stopSpeak(); setSpeaking(false);
    const r = V.createRecognizer(curLang.rec, {
      onStart:()=>setListening(true),
      onInterim:(t)=>setInterim(t),
      onFinal:(t)=>{ setInterim(''); if(t) send(t); },
      onEnd:()=>{ setListening(false); setInterim(''); },
      onError:(e)=>{ setListening(false); setInterim(''); if(e && e.error==='not-allowed') setVoiceErr('Microphone permission was blocked.'); },
    });
    if (!r) { setVoiceErr('Voice input is not available in this browser.'); return; }
    recRef.current = r; try { r.start(); } catch(e){}
  };
  const stopSpeaking = () => { V.stopSpeak && V.stopSpeak(); setSpeaking(false); };

  const empty = msgs.length === 0 && !typing;
  const sugg = askFocus
    ? ['Summarize this recording','What did I do well here?','What should I improve?','What’s my next step?']
    : (clips||[]).length === 0
      ? ['What can you do?','How do I get started?']
      : mode==='business'
        ? ['How am I trending across my calls?','What’s my biggest weakness?','Compare my last two recordings','What should I practice next?']
        : ['How do I sound lately?','What patterns do you notice?','Am I leaving space for others?','One small thing to try?'];

  return (
    <div className="ask-wrap">
      {/* clean toolbar: language, voice toggle, real context status */}
      <div className="voice-bar">
        <Dropdown icon="chat" label="Language" value={voicePrefs.lang} options={ASK_LANGS} onChange={(v)=>setVoice({lang:v})} />
        <div className="grow" />
        <span className="vchip ghost" title="What Kithra can see right now">
          <Icon name="layers" size={14} />{(clips||[]).length} recording{(clips||[]).length===1?'':'s'} · {transcribed} transcribed · {(books||[]).length} books
        </span>
        <span className={`vchip ${ready?'on':''}`} title={ready?'Connected to Kithra’s AI through your private cloud':'Cloud not connected'}>
          <Icon name="bolt" size={14} />{ready?'AI live':'Offline'}
        </span>
        <button className={`vchip ${voicePrefs.voiceReply?'on':''}`} onClick={()=>{ if(voicePrefs.voiceReply) stopSpeaking(); setVoice({voiceReply:!voicePrefs.voiceReply}); }} title="Speak answers aloud">
          <Icon name={voicePrefs.voiceReply?'wave':'pause'} size={15} />{voicePrefs.voiceReply?'Voice on':'Voice off'}
        </button>
      </div>

      {/* focused recording banner */}
      {askFocus && (
        <div className="row anim-in" style={{ gap:10, margin:'10px auto 0', maxWidth:760, width:'100%', padding:'10px 14px', borderRadius:'var(--r-ctrl)', background:'var(--accent-soft)', border:'1px solid color-mix(in srgb,var(--accent) 25%,transparent)' }}>
          <span className="center" style={{ width:30, height:30, borderRadius:9, background:'var(--accent)', color:'var(--accent-ink)', flex:'none' }}><Icon name="wave" size={15} /></span>
          <div className="stack grow" style={{ gap:1, minWidth:0 }}>
            <span style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Asking about: {askFocus.name||'Recording'}</span>
            <span className="faint" style={{ fontSize:11.5 }}>{fmtDur(askFocus.durSec)}{askFocus.transcript?' · transcript included':' · no transcript yet (acoustics only)'}</span>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ flex:'none' }} onClick={()=>setAskFocus(null)}>All recordings</button>
        </div>
      )}

      <div ref={scrollRef} className="ask-msgs scroll" style={{ overflowY:'auto' }}>
        {empty && (
          <div className="center anim-up" style={{ flex:1, textAlign:'center', padding:'20px 0' }}>
            <div className="stack center" style={{ gap:16, maxWidth:480 }}>
              <button className="talk-orb" onClick={toggleMic} aria-label="Talk to Kithra">
                <span className="talk-orb-glow" />
                <Icon name="mic" size={30} />
              </button>
              <div className="stack" style={{ gap:8 }}>
                <h2 className="display" style={{ fontSize:26, margin:0 }}>{askFocus?`Ask about “${(askFocus.name||'this recording').slice(0,38)}”`:'Ask across your recordings'}</h2>
                <p className="muted" style={{ margin:0, fontSize:14.5, lineHeight:1.55 }}>
                  {(clips||[]).length===0
                    ? 'You haven’t recorded anything yet — Kithra answers from your real data, so add a recording first and then ask away.'
                    : 'Kithra reads your actual recordings — the transcripts, the pace, the pauses — and answers like a coach who was in the room.'}
                </p>
              </div>
              {(clips||[]).length===0 && <button className="btn btn-primary" onClick={()=>go('analyze')}><Icon name="mic" size={16} />Record something first</button>}
              <PrivacyChip text="Questions use only what you’ve consented to share" />
            </div>
          </div>
        )}

        {msgs.map((m,i)=>(
          <div key={i} className={`ask-row ${m.role==='me'?'me':''} anim-up`}>
            {m.role==='ai'
              ? <span className="ask-av" style={{ background:'var(--accent)', color:'var(--accent-ink)' }}><Icon name="spark" size={17} /></span>
              : <Avatar label="You" color="var(--viz-1)" size={34} />}
            <div className={`ask-bubble ${m.role==='me'?'me':'ai'}`}>
              {m.role==='ai' && i===msgs.length-1 && speaking && (
                <div className="row" style={{ gap:8, marginBottom:8, color:'var(--accent-strong)' }}>
                  <span className="speak-eq"><i /><i /><i /><i /></span>
                  <span style={{ fontSize:11.5, fontWeight:600 }}>Speaking…</span>
                  <button className="linkbtn" style={{ fontSize:11.5 }} onClick={stopSpeaking}>stop</button>
                </div>
              )}
              <div style={{ whiteSpace:'pre-wrap' }}>{m.text}</div>
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
        {needConsent && (
          <div className="card anim-in" style={{ padding:'14px 16px', marginBottom:10, border:'1px solid color-mix(in srgb,var(--accent) 30%,transparent)', background:'var(--accent-soft)' }}>
            <div className="row" style={{ gap:10, marginBottom:8 }}><Icon name="shield" size={17} style={{ color:'var(--accent-strong)' }} /><span style={{ fontWeight:700, fontSize:13.5 }}>Allow Kithra to send context to the AI?</span></div>
            <p className="muted" style={{ margin:'0 0 10px', fontSize:12.5, lineHeight:1.5 }}>Your question plus recording summaries{transcribed>0?' and transcripts':''} go to Kithra’s AI to compose the answer — never for training, withdrawable anytime in Privacy → Consent.</p>
            <div className="row" style={{ gap:8 }}>
              <button className="btn btn-primary btn-sm" onClick={allowAndSend}><Icon name="check" size={14} />Allow & ask</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setNeedConsent(false)}>Not now</button>
            </div>
          </div>
        )}
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
            {sugg.map((s,i)=>(<button key={i} className="chip" onClick={()=>send(s)}>{s}</button>))}
          </div>
        )}
        <div className="ask-input">
          <button className={`mic-btn ${listening?'live':''}`} onClick={toggleMic} aria-label="Talk to Kithra" title="Ask by voice">
            <Icon name="mic" size={19} />
          </button>
          <textarea rows={1} placeholder={listening?'Listening…':askFocus?`Ask about ${askFocus.name||'this recording'}…`:'Ask about your recordings…'}
            value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }} />
          <button className="btn btn-icon btn-primary" style={{ width:42, height:42 }} onClick={()=>send()} aria-label="Send"><Icon name="send" size={18} /></button>
        </div>
        <div className="center" style={{ marginTop:8 }}><span className="faint" style={{ fontSize:11.5 }}>Answers are grounded in your real recordings · powered by Kithra’s AI through your private cloud</span></div>
      </div>
    </div>
  );
}

Object.assign(window, { AskKithra });

export { AskKithra };
