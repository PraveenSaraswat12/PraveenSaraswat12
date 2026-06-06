import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import { Panel } from './screens-dashboard.jsx';
/* ============================================================
   LUMEN — Single Conversation Deep-Dive
   ============================================================ */
const ANN = {
  objection:{ k:'bad',  c:'var(--bad)',  bg:'var(--bad-soft)',  ic:'flame' },
  pos:      { k:'good', c:'var(--good)', bg:'var(--good-soft)', ic:'heart' },
  signal:   { k:'accent', c:'var(--accent-strong)', bg:'var(--accent-soft)', ic:'spark' },
  shift:    { k:'warn', c:'var(--warn)', bg:'var(--warn-soft)', ic:'wave' },
};

function Conversation() {
  const { go, mode, showToast } = useApp();
  const t = window.LUMEN.transcript[mode];
  const [playing, setPlaying] = React.useState(false);
  const [prog, setProg] = React.useState(0.34);
  const [tab, setTab] = React.useState('all');
  const [expanded, setExpanded] = React.useState(false);
  const [doneItems, setDoneItems] = React.useState(()=>new Set());
  const totalSec = 1934; // ~32min display

  React.useEffect(() => {
    if (!playing) return;
    let raf, last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000; last = now;
      setProg(p => { const n = p + dt / 90; if (n >= 1) { setPlaying(false); return 1; } return n; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const fmt = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const cur = fmt(prog * totalSec);

  return (
    <div className="page">
      <div className="row" style={{ gap:12, marginBottom:18 }}>
        <button className="btn btn-icon btn-ghost" onClick={()=>go('dashboard')} aria-label="Back"><Icon name="chevL" size={18} /></button>
        <div className="stack" style={{ gap:2 }}>
          <span className="eyebrow">{mode==='business'?'Conversation':'Reflection'} deep-dive</span>
          <h1 className="display" style={{ fontSize:24, margin:0 }}>{t.title}</h1>
        </div>
      </div>

      <div className="cv-layout">
        <div className="stack" style={{ gap:'var(--gap)', minWidth:0 }}>
          {/* player */}
          <div className="cv-player">
            <div className="row" style={{ gap:14 }}>
              <button className="btn btn-icon btn-primary" style={{ width:48, height:48, borderRadius:'50%' }} onClick={()=>setPlaying(p=>!p)} aria-label={playing?'Pause':'Play'}>
                <Icon name={playing?'pause':'play'} size={20} fill />
              </button>
              <div className="grow" style={{ minWidth:0 }}>
                <div style={{ height:42 }}><Waveform bars={88} seed={5} height={42} progress={prog} gap={2} /></div>
              </div>
            </div>
            <div className="row" style={{ justifyContent:'space-between', marginTop:10 }}>
              <span className="row" style={{ gap:10 }}>
                <span className="tnum" style={{ fontSize:12.5, fontWeight:600 }}>{cur}</span>
                <span className="faint tnum" style={{ fontSize:12.5 }}>/ 32:14</span>
              </span>
              <span className="faint" style={{ fontSize:12.5 }}>{t.meta}</span>
            </div>
          </div>

          {/* transcript */}
          <Panel title="Transcript" sub="AI annotations highlight key moments"
            action={<div className="seg"><button className={tab==='all'?'on':''} onClick={()=>setTab('all')}>All</button><button className={tab==='key'?'on':''} onClick={()=>setTab('key')}>Key moments</button></div>}>
            <div>
              {(()=>{ const shown = t.lines.filter(ln=> tab==='all' ? true : !!ln.tag); const vis = expanded ? shown : shown.slice(0,5); return vis.map((ln,i)=>{
                const a = ln.tag ? ANN[ln.tag.k] : null;
                return (
                  <div key={i} className="tline">
                    <span className="tt">{ln.t}</span>
                    <div className="stack" style={{ gap:0, minWidth:0 }}>
                      <span className="row" style={{ gap:8, marginBottom:5 }}>
                        <span style={{ fontWeight:700, fontSize:12.5, color:ln.side==='rep'?'var(--accent-strong)':'var(--ink)' }}>{ln.who}</span>
                      </span>
                      <div className={`tbubble ${ln.side}`}>{ln.text}</div>
                      {a && <span className={`tann badge-${a.k}`} style={{ background:a.bg, color:a.c }}><Icon name={a.ic} size={13} />{ln.tag.l}</span>}
                    </div>
                  </div>
                );
              }); })()}
              {(() => { const shown = t.lines.filter(ln=> tab==='all' ? true : !!ln.tag); return shown.length>5 && (
                <div className="center" style={{ padding:'16px 0 4px' }}><button className="btn btn-soft btn-sm" onClick={()=>setExpanded(e=>!e)}><Icon name={expanded?'chevD':'chevD'} size={15} style={{ transform:expanded?'rotate(180deg)':'none' }} />{expanded?'Show less':'Show full transcript'}</button></div>
              ); })()}
            </div>
          </Panel>
        </div>

        {/* summary */}
        <div className="stack summary-card" style={{ gap:'var(--gap)' }}>
          <Panel title="Summary" sub="Generated by Kithra">
            <div className="stack" style={{ gap:18 }}>
              <div className="row" style={{ gap:16, alignItems:'center' }}>
                <Ring value={Math.round((t.sentiment+1)/2*100)} size={84} color={t.sentiment>=0?'var(--good)':'var(--viz-4)'} />
                <div className="stack" style={{ gap:3 }}>
                  <span className="eyebrow">Overall sentiment</span>
                  <span className="metric-num" style={{ fontSize:20, color:t.sentiment>=0?'var(--good)':'var(--viz-4)' }}>{t.sentiment>=0?'+':''}{t.sentiment.toFixed(2)}</span>
                  <span className="faint" style={{ fontSize:12 }}>{t.sentiment>=0.2?'Positive & engaged':t.sentiment>=-0.05?'Mixed':'Tense, then softening'}</span>
                </div>
              </div>
              <div>
                <span className="eyebrow" style={{ display:'block', marginBottom:7 }}>TL;DR</span>
                <p className="muted" style={{ margin:0, fontSize:13.5, lineHeight:1.6 }}>{t.tldr}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Action items">
            <div className="stack" style={{ gap:9 }}>
              {t.actions.map((a,i)=>{
                const done = doneItems.has(i);
                return (
                <label key={i} className="row click" style={{ gap:10, alignItems:'flex-start' }} onClick={()=>setDoneItems(s=>{ const n=new Set(s); n.has(i)?n.delete(i):n.add(i); return n; })}>
                  <span className="center" style={{ width:20, height:20, borderRadius:6, background:done?'var(--accent)':'var(--surface-sunken)', color:done?'#fff':'var(--ink-2)', flex:'none', marginTop:1, fontSize:11, fontWeight:700, border:done?'0':'1px solid var(--line)' }}>{done ? <Icon name="check" size={12} stroke={3} /> : i+1}</span>
                  <span style={{ fontSize:13.5, lineHeight:1.45, textDecoration:done?'line-through':'none', opacity:done?0.6:1 }}>{a}</span>
                </label>
                );
              })}
            </div>
          </Panel>

          <div className="card card-pad" style={{ background:'var(--accent-soft)', border:'1px solid color-mix(in srgb,var(--accent) 22%,transparent)' }}>
            <span className="row" style={{ gap:8, marginBottom:8 }}>
              <span className="center" style={{ width:30, height:30, borderRadius:9, background:'var(--accent)', color:'var(--accent-ink)' }}><Icon name="spark" size={16} /></span>
              <span style={{ fontWeight:700, fontSize:14, color:'var(--accent-strong)' }}>What to do next</span>
            </span>
            <p style={{ margin:0, fontSize:13.5, lineHeight:1.6, color:'var(--ink)' }}>{t.next}</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop:14, width:'100%' }} onClick={()=>go('ask')}><Icon name="chat" size={15} />Ask Kithra about this</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Conversation });


export { Conversation };
