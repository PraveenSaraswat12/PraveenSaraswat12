import React from 'react';
import { Icon, RealPlayer, redactPII, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import { Panel } from './screens-dashboard.jsx';
/* ============================================================
   KITHRA — Conversation deep-dive: a REAL recording's page
   Player + real transcript + Gemini insights for THIS clip.
   ============================================================ */
const fmtDur = (s)=>`${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,'0')}`;

function Conversation() {
  const { go, mode, convoFrom, viewConvo, clips, updateClip, hasConsent, grantConsent, showToast } = useApp();
  // resolve the clip live from state so transcript/insight updates flow in
  const clip = (clips||[]).find(c => viewConvo && c.id === viewConvo.id) || viewConvo || (clips||[])[0] || null;
  const a = (clip && clip.analysis) || {};
  const [busy, setBusy] = React.useState(false);
  const ins = clip && clip.insights;

  const runInsights = async () => {
    if (!clip) return;
    if (!window.KithraAI || !window.KithraAI.aiReady()) { showToast('Connect the cloud in Privacy & Data first','shield'); return; }
    if (!hasConsent('cloud_ai')) {
      grantConsent('cloud_ai'); // explicit click on "Generate" = consent for this purpose; recorded in ledger
    }
    setBusy(true);
    try {
      const out = await window.KithraAI.clipInsights(clip, mode);
      updateClip(clip.id, { insights: out });
      showToast('Insights ready','spark');
    } catch(e){ showToast('AI is unreachable right now — try again','x'); }
    setBusy(false);
  };

  if (!clip) {
    return (
      <div className="page center" style={{ minHeight:'60vh' }}>
        <div className="stack center" style={{ gap:14, maxWidth:380, textAlign:'center' }}>
          <Icon name="wave" size={28} />
          <h2 className="display" style={{ fontSize:22, margin:0 }}>No recording selected</h2>
          <p className="muted" style={{ margin:0, fontSize:13.5 }}>Pick a recording from your library, or make a new one.</p>
          <div className="row center" style={{ gap:10 }}>
            <button className="btn btn-primary" onClick={()=>go('analyze')}><Icon name="mic" size={16} />Record / upload</button>
            <button className="btn btn-soft" onClick={()=>go('library')}>My recordings</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="row" style={{ gap:12, marginBottom:18 }}>
        <button className="btn btn-icon btn-ghost" onClick={()=>go(convoFrom||'library')} aria-label="Back"><Icon name="chevL" size={18} /></button>
        <div className="stack" style={{ gap:2, minWidth:0 }}>
          <span className="eyebrow">Recording deep-dive</span>
          <h1 className="display" style={{ fontSize:24, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{clip.name||'Recording'}</h1>
        </div>
        <div className="grow" />
        <button className="btn btn-soft" style={{ flex:'none' }} onClick={()=>go('ask',{ask:clip})}><Icon name="chat" size={16} />Ask about this</button>
      </div>

      <div className="cv-layout">
        <div className="stack" style={{ gap:'var(--gap)', minWidth:0 }}>
          {/* real player */}
          <div className="cv-player">
            {clip.url
              ? <RealPlayer src={clip.url} peaks={a.peaks||clip.peaks} durSec={clip.durSec} />
              : <div className="row" style={{ gap:10, padding:'8px 4px' }}><Icon name="shield" size={16} style={{ color:'var(--ink-3)' }} /><span className="faint" style={{ fontSize:13 }}>Audio stayed on the device where it was recorded. Metadata{clip.transcript?' & transcript':''} are synced.</span></div>}
            <div className="row wrap" style={{ gap:14, marginTop:12 }}>
              <span className="lib-meta tnum"><Icon name="clock" size={12} />{fmtDur(clip.durSec)}</span>
              {a.wpm!=null && <span className="lib-meta tnum"><Icon name="bolt" size={12} />{a.wpm} wpm</span>}
              {a.talkRatio!=null && <span className="lib-meta tnum"><Icon name="wave" size={12} />{Math.round(a.talkRatio*100)}% voice</span>}
              {a.pauses!=null && <span className="lib-meta tnum"><Icon name="pause" size={12} />{a.pauses} pauses</span>}
              {a.expressiveness!=null && <span className="lib-meta tnum"><Icon name="spark" size={12} />{a.expressiveness}/100 energy</span>}
            </div>
          </div>

          {/* real transcript */}
          <Panel title="Transcript" sub={clip.transcript ? 'What was actually said' : 'Not transcribed yet'}>
            {clip.transcript
              ? <p style={{ margin:0, fontSize:14.5, lineHeight:1.75, whiteSpace:'pre-wrap' }}>{clip.transcript}</p>
              : (
                <div className="stack" style={{ gap:12 }}>
                  <p className="muted" style={{ margin:0, fontSize:13.5, lineHeight:1.55 }}>Transcribe this recording to unlock word-level insights, search, and a sharper AI read.</p>
                  <button className="btn btn-primary btn-sm" style={{ alignSelf:'flex-start' }} onClick={()=>{ go('analyze'); }}>
                    <Icon name="file" size={14} />Transcribe on the Analyze page
                  </button>
                </div>
              )}
          </Panel>

          {/* energy curve */}
          {Array.isArray(a.energy) && a.energy.length>2 && (
            <Panel title="Vocal energy" sub="Loudness over this recording (measured on-device)">
              <LineChart series={[{ color:'var(--accent)', data:a.energy }]} height={150} yMin={0} yMax={1.05} labels={a.energy.map(()=> '')} />
            </Panel>
          )}
        </div>

        {/* AI summary column */}
        <div className="stack summary-card" style={{ gap:'var(--gap)' }}>
          <Panel title="Kithra’s insights" sub="Generated by Kithra’s AI from this recording" action={<Badge kind="accent">AI</Badge>}>
            {ins ? (
              <div className="stack" style={{ gap:14 }}>
                <div><span className="eyebrow" style={{ display:'block', marginBottom:6 }}>Summary</span><p style={{ margin:0, fontSize:13.5, lineHeight:1.6 }}>{ins.summary}</p></div>
                {ins.win && <div className="row" style={{ gap:10, alignItems:'flex-start' }}><span className="center" style={{ width:26, height:26, borderRadius:8, background:'var(--good-soft)', color:'var(--good)', flex:'none' }}><Icon name="check" size={14} /></span><span style={{ fontSize:13, lineHeight:1.5 }}>{ins.win}</span></div>}
                {ins.improve && <div className="row" style={{ gap:10, alignItems:'flex-start' }}><span className="center" style={{ width:26, height:26, borderRadius:8, background:'var(--warn-soft)', color:'var(--warn)', flex:'none' }}><Icon name="trend" size={14} /></span><span style={{ fontSize:13, lineHeight:1.5 }}>{ins.improve}</span></div>}
                {ins.next && <div className="card" style={{ padding:'12px 14px', background:'var(--accent-soft)' }}><span className="eyebrow" style={{ display:'block', marginBottom:4 }}>Next step</span><span style={{ fontSize:13.5, lineHeight:1.55, fontWeight:600 }}>{ins.next}</span></div>}
                <button className="btn btn-soft btn-sm" style={{ alignSelf:'flex-start' }} disabled={busy} onClick={runInsights}><Icon name="refresh" size={14} />{busy?'Thinking…':'Regenerate'}</button>
              </div>
            ) : (
              <div className="stack" style={{ gap:12 }}>
                <p className="muted" style={{ margin:0, fontSize:13.5, lineHeight:1.6 }}>
                  {clip.transcript
                    ? 'Get a real AI read of this conversation — summary, what worked, what to improve, and your next step.'
                    : 'Works best after transcription, but Kithra can already read the acoustics — pace, pauses, energy.'}
                </p>
                <button className="btn btn-primary" disabled={busy} onClick={runInsights}>
                  {busy ? <><LiveWave bars={5} height={14} color="currentColor" /> Thinking…</> : <><Icon name="spark" size={16} fill />Generate insights</>}
                </button>
                <span className="faint" style={{ fontSize:11.5 }}>Sends this recording’s metrics{clip.transcript?' + transcript':''} to the AI — recorded in your consent ledger.</span>
              </div>
            )}
          </Panel>

          <div className="card card-pad" style={{ background:'var(--surface-2)' }}>
            <PrivacyChip text="Audio analyzed on-device" />
            <span className="faint" style={{ fontSize:11.5, display:'block', marginTop:8, lineHeight:1.5 }}>Only what you explicitly send (transcript & metrics for insights) reaches the AI — never the raw audio without consent.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Conversation });

export { Conversation };
