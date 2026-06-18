import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   LUMEN — Processing / Analysis in progress
   ============================================================ */
function Processing() {
  const { go, mode, t, setTweak } = useApp();
  const total = mode === 'business' ? 1000 : 24;
  const [done, setDone] = React.useState(0);
  const [findings, setFindings] = React.useState([]);
  const [complete, setComplete] = React.useState(false);

  const findingPool = mode === 'business' ? [
    { ic:'trend', c:'var(--good)', bg:'var(--good-soft)', t:'Multi-threaded deals close 28% more often', s:'Spotted across 412 calls' },
    { ic:'quote', c:'var(--viz-3)', bg:'var(--warn-soft)', t:'\u201cBudget\u201d is the most common objection', s:'Appears in 31% of late-stage calls' },
    { ic:'wave', c:'var(--viz-1)', bg:'var(--accent-soft)', t:'Sentiment lifts when peers are mentioned', s:'Positive shift within 90 seconds' },
    { ic:'target', c:'var(--viz-2)', bg:'var(--good-soft)', t:'4 deals need attention this week', s:'Single-threaded for 3+ calls' },
  ] : [
    { ic:'heart', c:'var(--good)', bg:'var(--good-soft)', t:'Your tone lifts when you talk about projects', s:'Noticed across 41 reflections' },
    { ic:'flame', c:'var(--viz-3)', bg:'var(--warn-soft)', t:'Evenings carry more tension', s:'2.4\u00d7 more than mornings' },
    { ic:'quote', c:'var(--viz-1)', bg:'var(--accent-soft)', t:'A reflex \u201csorry\u201d opens many work talks', s:'1 in 3 conversations' },
    { ic:'wave', c:'var(--viz-2)', bg:'var(--good-soft)', t:'You\u2019re listening more this month', s:'Balance up from 39% to 46%' },
  ];

  React.useEffect(() => {
    let raf, start = performance.now();
    const dur = 7200;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 2.2);
      setDone(Math.floor(eased * total));
      if (p < 1) raf = requestAnimationFrame(tick); else { setDone(total); setComplete(true); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  React.useEffect(() => {
    const times = [1100, 2600, 4200, 5800];
    const timers = times.map((ms, i) => setTimeout(() => setFindings(f => [...f, findingPool[i]]), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  const pct = Math.round((done / total) * 100);

  return (
    <div className="proc-wrap">
      <button className="row click" style={{ position:'fixed', top:22, left:'clamp(20px,4vw,40px)', gap:9, background:'none', border:0 }} onClick={()=>go('landing')}>
        <LumenMark size={26} /><span style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:600 }}>Kithra</span>
      </button>

      <div style={{ maxWidth:520 }}>
        <span className="badge badge-accent" style={{ height:28, padding:'0 13px' }}>
          {complete ? <><Icon name="check" size={13} stroke={3} /> Analysis complete</> : <><span className="dot" style={{ background:'var(--accent)' }} /> Analyzing privately</>}
        </span>

        <div className="proc-orb" style={{ marginTop:26 }}>
          <div className="proc-glow" />
          <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center' }}>
            {complete
              ? <div className="center" style={{ width:96, height:96, borderRadius:'50%', background:'var(--accent)', color:'var(--accent-ink)', animation:'popIn .5s var(--ease)' }}><Icon name="check" size={44} stroke={2.4} /></div>
              : <LiveWave bars={44} height={120} color="var(--accent)" />}
          </div>
        </div>

        <h1 className="display" style={{ fontSize:'clamp(26px,3.4vw,38px)', margin:'30px 0 10px' }}>
          {complete ? 'Your insights are ready' : 'Listening to your conversations'}
        </h1>
        <p className="muted" style={{ fontSize:15.5, margin:0, lineHeight:1.55 }}>
          {complete
            ? `Kithra analyzed ${total.toLocaleString()} ${mode==='business'?'calls':'recordings'}. Here\u2019s a first look at what stood out.`
            : 'Transcribing, reading tone, and finding the moments that matter. Nothing leaves your private workspace.'}
        </p>

        {!complete && (
          <div style={{ marginTop:26 }}>
            <div className="row" style={{ justifyContent:'space-between', marginBottom:9 }}>
              <span style={{ fontWeight:600, fontSize:13.5 }} className="tnum">Analyzing {done.toLocaleString()} of {total.toLocaleString()} {mode==='business'?'calls':'recordings'}</span>
              <span className="tnum faint" style={{ fontSize:13.5 }}>{pct}%</span>
            </div>
            <div className="bar" style={{ height:9 }}><i style={{ width:`${pct}%`, transition:'width .2s linear' }} /></div>
            <div className="proc-stat">
              {[['Transcribed', `${Math.min(done, total).toLocaleString()}`],['Tone read', `${Math.floor(done*0.92).toLocaleString()}`],['Patterns', `${Math.floor(done/55)}`]].map((s,i)=>(
                <div key={i} className="stack" style={{ gap:3 }}><span className="metric-num" style={{ fontSize:20 }}>{s[1]}</span><span className="faint" style={{ fontSize:12 }}>{s[0]}</span></div>
              ))}
            </div>
          </div>
        )}

        {findings.length > 0 && (
          <div className="proc-finds">
            <div className="row" style={{ justifyContent:'center', gap:8, marginBottom:2 }}>
              <span className="faint" style={{ fontSize:12.5, fontWeight:600 }}>{complete?'What stood out':'Early findings'}</span>
            </div>
            {findings.map((f,i)=>(
              <div key={i} className="proc-find" style={{ animation:'fadeUp .45s var(--ease) both' }}>
                <span className="center" style={{ width:38, height:38, borderRadius:11, background:f.bg, color:f.c, flex:'none' }}><Icon name={f.ic} size={19} /></span>
                <div className="stack" style={{ gap:2 }}>
                  <span style={{ fontWeight:650, fontSize:14 }}>{f.t}</span>
                  <span className="faint" style={{ fontSize:12.5 }}>{f.s}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop:34 }}>
          {complete
            ? <button className="btn btn-primary btn-lg" onClick={()=>go('dashboard')}>Open my dashboard <Icon name="arrowR" size={18} /></button>
            : <button className="btn btn-ghost" onClick={()=>go('dashboard')}>Skip to dashboard</button>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Processing });


export { Processing };
