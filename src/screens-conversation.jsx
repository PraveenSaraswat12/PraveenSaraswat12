import React from 'react';
import { Icon, RealPlayer, redactPII, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import { Panel } from './screens-dashboard.jsx';
/* ============================================================
   KITHRA — Conversation deep-dive: a REAL recording's page
   Player + real transcript + Gemini insights for THIS clip.
   ============================================================ */
const fmtDur = (s)=>`${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,'0')}`;
const TONE_META = {
  positive: { label:'Positive', cls:'badge-good', ic:'heart' },
  negative: { label:'Negative', cls:'badge-bad', ic:'shield' },
  neutral:  { label:'Neutral',  cls:'badge-neutral', ic:'wave' },
};

// ---- rule-based coaching recommendations — always available, no AI call ----
// Complements the AI-generated insights panel with concrete, metric-driven
// tips derived purely from this recording's own acoustics/tone/transcript.
function buildRecommendations(a, transcript, durSec) {
  const tips = [];
  if (a.talkRatio != null) {
    const tr = Math.round(a.talkRatio * 100);
    if (tr >= 75) tips.push({ ic:'chat', title:'You did most of the talking', body:`You were speaking ${tr}% of the time — try an open question to invite more input.` });
    else if (tr > 0 && tr <= 30) tips.push({ ic:'mic', title:'Mostly listening', body:`Only ${tr}% active voice — good for a listening-heavy moment, but make sure your own points land too.` });
  }
  if (a.wpm != null && a.wpm > 0) {
    if (a.wpm > 175) tips.push({ ic:'bolt', title:'Brisk pace', body:`~${a.wpm} words/min — a few deliberate pauses would help key points land.` });
    else if (a.wpm < 110) tips.push({ ic:'clock', title:'Unhurried pace', body:`~${a.wpm} words/min — a touch more energy can help keep engagement up.` });
  }
  if (a.pauses != null && durSec) {
    const perMin = a.pauses / Math.max(1, durSec / 60);
    if (perMin > 4) tips.push({ ic:'pause', title:'Frequent pauses', body:`${a.pauses} pauses in this recording — organizing your key points beforehand can help things flow more smoothly.` });
  }
  if (a.expressiveness != null && a.expressiveness < 28) {
    tips.push({ ic:'spark', title:'Flat delivery', body:'Vocal energy stayed fairly level — varying your tone helps important moments stand out.' });
  }
  if (a.tone && a.tone.label === 'negative') {
    tips.push({ ic:'shield', title:'This one trended negative', body:'Consider a short follow-up to check in and address any concerns that came up.' });
  }
  if (transcript && window.transcriptInsights) {
    const ti = window.transcriptInsights(transcript, durSec);
    if (ti && ti.fillers >= 6) tips.push({ ic:'wave', title:`${ti.fillers} filler words`, body:'Words like "um", "like", "basically" came up often — a brief pause instead can read as more confident.' });
  }
  if (!tips.length) tips.push({ ic:'check', title:'Solid all-round delivery', body:'Nothing stands out to flag here — pace, balance and energy all look healthy for this recording.' });
  return tips.slice(0, 4);
}

function Conversation() {
  const { go, mode, convoFrom, viewConvo, clips, updateClip, hasConsent, grantConsent, showToast } = useApp();
  // resolve the clip live from state so transcript/insight updates flow in
  const clip = (clips||[]).find(c => viewConvo && c.id === viewConvo.id) || viewConvo || (clips||[])[0] || null;
  const a = (clip && clip.analysis) || {};
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [curTime, setCurTime] = React.useState(0);
  const playerRef = React.useRef(null);
  const ins = clip && clip.insights;
  const tone = a.tone && TONE_META[a.tone.label];
  const segments = Array.isArray(a.segments) ? a.segments : null;

  const runInsights = async () => {
    if (!clip) return;
    if (!window.KithraAI || !window.KithraAI.aiReady()) { showToast('Connect the cloud in Privacy & Data first','shield'); return; }
    if (!hasConsent('cloud_ai')) {
      grantConsent('cloud_ai'); // explicit click on "Generate" = consent for this purpose; recorded in ledger
    }
    setBusy(true);
    try {
      const out = await window.KithraAI.clipInsights(clip, mode);
      // AI's own tone read (more nuanced than the lexicon baseline) overwrites it
      // when available; updateClip merges analysis, so this can't clobber other fields.
      const patch = { insights: out };
      if (out.tone) patch.analysis = { tone: out.tone };
      updateClip(clip.id, patch);
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
              ? <RealPlayer ref={playerRef} src={clip.url} peaks={a.peaks||clip.peaks} durSec={clip.durSec} onTime={setCurTime} />
              : <div className="row" style={{ gap:10, padding:'8px 4px' }}><Icon name="shield" size={16} style={{ color:'var(--ink-3)' }} /><span className="faint" style={{ fontSize:13 }}>Audio stayed on the device where it was recorded. Metadata{clip.transcript?' & transcript':''} are synced.</span></div>}
            <div className="row wrap" style={{ gap:14, marginTop:12 }}>
              <span className="lib-meta tnum"><Icon name="clock" size={12} />{fmtDur(clip.durSec)}</span>
              {a.wpm!=null && <span className="lib-meta tnum"><Icon name="bolt" size={12} />{a.wpm} wpm</span>}
              {a.talkRatio!=null && <span className="lib-meta tnum"><Icon name="wave" size={12} />{Math.round(a.talkRatio*100)}% voice</span>}
              {a.pauses!=null && <span className="lib-meta tnum"><Icon name="pause" size={12} />{a.pauses} pauses</span>}
              {a.expressiveness!=null && <span className="lib-meta tnum"><Icon name="spark" size={12} />{a.expressiveness}/100 energy</span>}
              {tone && <span className={`badge ${tone.cls}`} style={{ height:22 }}><Icon name={tone.ic} size={11} fill />{tone.label}</span>}
            </div>
          </div>

          {/* real transcript — transcribe RIGHT HERE when the audio is on this device.
              When timestamped segments are available (Kithra AI/Groq), the transcript
              is interactive: click a line to jump the player there, and the line
              being spoken highlights automatically as the audio plays. */}
          {clip.transcript ? (
            <Panel title="Transcript" sub={segments ? 'Click a line to jump to it' : 'What was actually said'}
              action={<button className="btn btn-soft btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(clip.transcript); } catch (e) {} setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                <Icon name={copied ? 'check' : 'file'} size={13} />{copied ? 'Copied' : 'Copy'}
              </button>}>
              {segments ? (
                <div className="cv-transcript-segs scroll" style={{ maxHeight:320, overflow:'auto' }}>
                  {segments.map((s, i) => {
                    const end = s.end != null ? s.end : (segments[i+1] ? segments[i+1].start : (s.start + 6));
                    const active = clip.url && curTime >= s.start && curTime < end;
                    return (
                      <span key={i} className={`cv-seg${active ? ' active' : ''}`}
                        onClick={() => playerRef.current && playerRef.current.seekTo(s.start)}
                        title={clip.url ? `Jump to ${fmtDur(s.start)}` : undefined}>
                        {s.text}{' '}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p style={{ margin:0, fontSize:14.5, lineHeight:1.75, whiteSpace:'pre-wrap' }}>{clip.transcript}</p>
              )}
            </Panel>
          ) : (clip.url && window.TranscriptPanel) ? (
            React.createElement(window.TranscriptPanel, { clipUrl: clip.url, clipId: clip.id, durSec: clip.durSec })
          ) : (
            <Panel title="Transcript" sub="Not transcribed yet">
              <p className="muted" style={{ margin:0, fontSize:13.5, lineHeight:1.55 }}>This recording’s audio isn’t stored on this device, so it can’t be transcribed here. Open Kithra on the device where you recorded it, or add the audio again via Analyze.</p>
            </Panel>
          )}

          {/* recommendations — always-available, metric-driven coaching tips */}
          <Panel title="Recommendations" sub="Concrete tips from this recording's pace, balance and tone">
            <div className="stack" style={{ gap:12 }}>
              {buildRecommendations(a, clip.transcript, clip.durSec).map((r, i) => (
                <div key={i} className="row" style={{ gap:10, alignItems:'flex-start' }}>
                  <span className="center" style={{ width:26, height:26, borderRadius:8, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name={r.ic} size={14} /></span>
                  <span style={{ fontSize:13, lineHeight:1.5 }}><b>{r.title}.</b> {r.body}</span>
                </div>
              ))}
              {ins && ins.recommend && (
                <div className="card" style={{ padding:'12px 14px', background:'var(--accent-soft)' }}>
                  <span className="eyebrow" style={{ display:'block', marginBottom:4 }}>Kithra AI, from what was actually said</span>
                  <span style={{ fontSize:13.5, lineHeight:1.55, fontWeight:600 }}>{ins.recommend}</span>
                </div>
              )}
            </div>
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
          <Panel title="Kithra’s insights" sub="Generated by Kithra AI from this recording" action={<Badge kind="accent">Kithra AI</Badge>}>
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
