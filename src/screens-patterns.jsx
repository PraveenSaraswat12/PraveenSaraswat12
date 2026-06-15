import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import { Panel } from './screens-dashboard.jsx';
import { askKithra, aiReady } from './ai.js';
/* ============================================================
   KITHRA — Patterns: trends computed from YOUR real recordings
   (no sample data; AI pattern-read via Gemini on demand)
   ============================================================ */
function Patterns() {
  const { go, mode, clips, books, hasConsent, grantConsent, showToast, planAllows } = useApp();

  // Plan gate: Patterns (trends + AI pattern-read) is a Plus feature. Block the
  // screen itself, not just the nav item, so no entry path (hash, search, deep
  // links) can reach the content on Free.
  if (!planAllows('plus')) {
    return (
      <div className="page">
        <div className="card center anim-up" style={{ padding:'64px 24px' }}>
          <div className="stack center" style={{ gap:14, maxWidth:440, textAlign:'center' }}>
            <span className="center" style={{ width:58, height:58, borderRadius:18, background:'var(--accent-soft)', color:'var(--accent-strong)' }}><Icon name="lock" size={26} /></span>
            <span className="lock-pill" data-tier="plus"><Icon name="lock" size={9} />Plus</span>
            <h3 className="display" style={{ fontSize:22, margin:0 }}>Patterns is a Plus feature</h3>
            <p className="muted" style={{ margin:0, fontSize:14, lineHeight:1.55 }}>Upgrade to Plus to see how your pace, pausing, talk-balance and energy trend across every recording — plus Kithra’s AI read of what’s actually changing.</p>
            <button className="btn btn-primary btn-lg" onClick={()=>go('pricing')}><Icon name="spark" size={18} fill />Upgrade to Plus</button>
          </div>
        </div>
      </div>
    );
  }

  const ordered = [...(clips||[])].sort((x,y)=>(x.ts||0)-(y.ts||0));
  const a = (c)=>c.analysis||{};
  const series = (f)=> ordered.map(c=>({ v:f(a(c)), name:c.name })).filter(p=>p.v!=null);
  const wpm = series(x=>x.wpm);
  const voice = series(x=>x.talkRatio!=null?Math.round(x.talkRatio*100):null);
  const energy = series(x=>x.expressiveness);
  const pauses = series(x=>x.pauses);
  const enough = ordered.length >= 2;

  const [read, setRead] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const runRead = async () => {
    if (!aiReady()) { showToast('Connect the cloud in Privacy & Data first','shield'); return; }
    if (!hasConsent('cloud_ai')) grantConsent('cloud_ai');
    setBusy(true);
    try {
      const out = await askKithra({ question:
        'Look across ALL my recordings and name the clearest patterns: how my pace, pausing and energy are trending, anything consistent in what I say (if transcripts exist), and the single most useful habit to build next. 4-6 sentences.',
        mode, clips, books });
      setRead(out);
    } catch(e){ setRead('Couldn’t reach the AI just now — try again in a moment.'); }
    setBusy(false);
  };

  const Trend = ({ title, sub, color, data, yMax }) => (
    <Panel title={title} sub={sub}>
      {data.length>1
        ? <LineChart series={[{ color, data:data.map((p,x)=>({x, y:p.v})) }]} height={170} yMin={0} yMax={yMax} labels={data.map(()=> '')} />
        : <p className="faint" style={{ fontSize:13, margin:0 }}>Needs at least 2 recordings.</p>}
      {data.length>1 && (
        <div className="row" style={{ justifyContent:'space-between', marginTop:8 }}>
          <span className="faint tnum" style={{ fontSize:11 }}>{data[0].name?.slice(0,18)||'first'}</span>
          <span className="faint tnum" style={{ fontSize:11 }}>{data[data.length-1].name?.slice(0,18)||'latest'}</span>
        </div>
      )}
    </Panel>
  );

  return (
    <div className="page">
      <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-end', marginBottom:18, flexWrap:'wrap', gap:14 }}>
        <div className="stack" style={{ gap:6 }}>
          <span className="eyebrow">Over time</span>
          <h1 className="display" style={{ fontSize:28, margin:0 }}>Patterns & trends</h1>
        </div>
        <span className="badge badge-neutral" style={{ height:30 }}><Icon name="wave" size={13} />{ordered.length} recording{ordered.length===1?'':'s'} analyzed</span>
      </div>

      {!enough ? (
        <div className="card center anim-up" style={{ padding:'64px 24px' }}>
          <div className="stack center" style={{ gap:14, maxWidth:430, textAlign:'center' }}>
            <span className="center" style={{ width:58, height:58, borderRadius:18, background:'var(--accent-soft)', color:'var(--accent-strong)' }}><Icon name="trend" size={26} /></span>
            <h3 className="display" style={{ fontSize:22, margin:0 }}>Patterns need at least two recordings</h3>
            <p className="muted" style={{ margin:0, fontSize:14, lineHeight:1.55 }}>You have {ordered.length===0?'none yet':'just one'}. Each new recording adds a real data point — pace, pausing, talk-balance, energy — and this page starts showing how you’re changing.</p>
            <button className="btn btn-primary btn-lg" onClick={()=>go('analyze')}><Icon name="mic" size={18} />Add a recording</button>
          </div>
        </div>
      ) : (
        <>
          {/* AI pattern read */}
          <Panel title="Kithra’s pattern read" sub="Kithra’s AI, across every recording you’ve made" style={{ marginBottom:'var(--gap)' }}
            action={<Badge kind="accent" dot={busy}>AI</Badge>}>
            {read
              ? <div className="stack" style={{ gap:12 }}><p style={{ margin:0, fontSize:14.5, lineHeight:1.65 }}>{read}</p>
                  <button className="btn btn-soft btn-sm" style={{ alignSelf:'flex-start' }} disabled={busy} onClick={runRead}><Icon name="refresh" size={14} />Refresh</button></div>
              : <div className="stack" style={{ gap:12 }}>
                  <p className="muted" style={{ margin:0, fontSize:13.5, lineHeight:1.6 }}>Ask the AI to look across all {ordered.length} recordings and name what’s actually changing.</p>
                  <button className="btn btn-primary btn-sm" style={{ alignSelf:'flex-start' }} disabled={busy} onClick={runRead}>{busy?'Reading…':<><Icon name="spark" size={14} fill />Find my patterns</>}</button>
                </div>}
          </Panel>

          <div className="grid g-2" style={{ gap:'var(--gap)', marginBottom:'var(--gap)' }}>
            <Trend title="Speaking pace" sub="Words per minute, per recording" color="var(--accent)" data={wpm} />
            <Trend title="Talk vs. listen" sub="Active-voice share, per recording" color="var(--viz-2)" data={voice} yMax={100} />
            <Trend title="Vocal energy" sub="Expressiveness (0–100), per recording" color="var(--viz-3)" data={energy} yMax={100} />
            <Trend title="Pausing" sub="Notable pauses, per recording" color="var(--viz-5)" data={pauses} />
          </div>

          {Array.isArray(books) && books.length>0 && (
            <Panel title="Grounded in your library" sub="Kithra reads your patterns through the books you trust">
              <EvidenceList items={books.slice(0,5).map(b=>({ title:b.title, author:b.author, type:b.type }))} label="Drawing on" />
              <button className="btn btn-soft btn-sm" style={{ marginTop:12 }} onClick={()=>go('books')}><Icon name="book" size={14} />Manage books</button>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

Object.assign(window, { Patterns });

export { Patterns };
