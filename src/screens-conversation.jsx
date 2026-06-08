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

function hashId(s){ let h=0; s=String(s||''); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h; }
function parseDur(s){ if(!s||typeof s!=='string') return 0; const p=s.split(':').map(Number); return p.length===2 && p.every(n=>!isNaN(n)) ? p[0]*60+p[1] : 0; }
function fmtDurS(s){ return `${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,'0')}`; }

// a few coherent transcripts per mode — picked per-recording so each row opens its own deep-dive
const SCRIPTS = {
  business: [
    [
      { t:'00:42', who:'You', side:'rep', text:'Before we talk numbers — what would make this an easy yes for your team?' },
      { t:'00:58', who:'Them', side:'cust', text:'The value’s clear. It’s really about the budget we set for this quarter.', tag:{k:'objection',l:'Objection — budget'} },
      { t:'02:14', who:'You', side:'rep', text:'Fair. A similar team started with two regions and expanded once it paid for itself.', tag:{k:'pos',l:'Peer story'} },
      { t:'02:51', who:'Them', side:'cust', text:'Interesting — how fast did they see a return?', tag:{k:'signal',l:'Buying signal'} },
      { t:'03:20', who:'You', side:'rep', text:'About six weeks. I’ll put the exact numbers in a one-pager you can forward up.' },
      { t:'06:10', who:'Them', side:'cust', text:'My only worry is getting my VP on board before quarter-end.', tag:{k:'shift',l:'New stakeholder'} },
      { t:'06:32', who:'You', side:'rep', text:'Let’s get 20 minutes with them next week — I’ll handle the ROI part.' },
    ],
    [
      { t:'01:05', who:'You', side:'rep', text:'What’s working and not working with your current setup?' },
      { t:'01:30', who:'Them', side:'cust', text:'Honestly we’re fairly locked in with what we use today.', tag:{k:'objection',l:'Competitor lock-in'} },
      { t:'03:12', who:'You', side:'rep', text:'Most teams kept theirs and ran us alongside for the gaps.', tag:{k:'pos',l:'Reframe'} },
      { t:'04:40', who:'Them', side:'cust', text:'Does it actually integrate with our stack, though?', tag:{k:'signal',l:'Technical interest'} },
      { t:'05:02', who:'You', side:'rep', text:'Yes — native connectors, and I’ll have our SE confirm your exact tools.' },
      { t:'08:18', who:'Them', side:'cust', text:'If the integration is clean, this could be worth piloting.', tag:{k:'pos',l:'Positive shift'} },
      { t:'09:01', who:'You', side:'rep', text:'Let’s scope a two-week pilot on one team — low risk, clear metric.' },
    ],
    [
      { t:'00:50', who:'You', side:'rep', text:'Where does solving this sit on your priorities right now?' },
      { t:'01:12', who:'Them', side:'cust', text:'It matters, but it might be a next-quarter thing for us.', tag:{k:'objection',l:'No urgency'} },
      { t:'02:35', who:'You', side:'rep', text:'What changes for the team if it slips a quarter?', tag:{k:'signal',l:'Cost of inaction'} },
      { t:'02:58', who:'Them', side:'cust', text:'We’d keep losing time on manual reviews — which is the whole problem.', tag:{k:'pos',l:'Pain quantified'} },
      { t:'05:20', who:'You', side:'rep', text:'Then even a small start now pays for itself before next quarter begins.' },
      { t:'06:45', who:'Them', side:'cust', text:'Send me something I can take to the team this week.', tag:{k:'shift',l:'Next step'} },
      { t:'07:02', who:'You', side:'rep', text:'Done — a one-pager today, and let’s hold time Thursday to decide.' },
    ],
  ],
  personal: [
    [
      { t:'00:20', who:'You', side:'rep', text:'Sorry, I know this is probably a bad time to bring this up…', tag:{k:'shift',l:'Reflex apology'} },
      { t:'00:38', who:'Them', side:'cust', text:'It’s fine. What’s going on?' },
      { t:'01:55', who:'You', side:'rep', text:'I felt like I wasn’t being heard earlier and it got to me.', tag:{k:'objection',l:'Tension rising'} },
      { t:'03:12', who:'You', side:'rep', text:'…okay. Can you help me understand how it looked from your side?', tag:{k:'pos',l:'Asked, not defended'} },
      { t:'03:40', who:'Them', side:'cust', text:'Yeah — I think we both got defensive too fast.' },
      { t:'04:18', who:'You', side:'rep', text:'That’s fair. I want to get this right.', tag:{k:'pos',l:'Tone softened'} },
      { t:'07:02', who:'You', side:'rep', text:'I get short when I’m tired — that’s on me.', tag:{k:'signal',l:'Self-awareness'} },
    ],
    [
      { t:'00:15', who:'You', side:'rep', text:'Thinking out loud on the walk — what actually matters today.' },
      { t:'00:48', who:'You', side:'rep', text:'I keep circling the same project; there’s real energy there.', tag:{k:'pos',l:'Motivation'} },
      { t:'02:05', who:'You', side:'rep', text:'But I’m tense about the calendar — too many things stacked.', tag:{k:'objection',l:'Overwhelm'} },
      { t:'03:30', who:'You', side:'rep', text:'One thing at a time. What’s the single next step?', tag:{k:'signal',l:'Self-coaching'} },
      { t:'04:10', who:'You', side:'rep', text:'Block the morning for the deep work, and protect it.', tag:{k:'pos',l:'Plan'} },
      { t:'05:00', who:'You', side:'rep', text:'And say no to the 4pm if it’s not essential.' },
      { t:'05:40', who:'You', side:'rep', text:'Good. That feels lighter already.', tag:{k:'pos',l:'Tone lifted'} },
    ],
    [
      { t:'00:30', who:'You', side:'rep', text:'Hey — sorry it’s been a while, things have been full on.', tag:{k:'shift',l:'Reflex apology'} },
      { t:'00:52', who:'Them', side:'cust', text:'It’s okay. Tell me how you actually are.' },
      { t:'02:10', who:'You', side:'rep', text:'Honestly, a bit stretched. But better for hearing your voice.', tag:{k:'pos',l:'Warmth'} },
      { t:'03:25', who:'Them', side:'cust', text:'You always take too much on. Are you resting?' },
      { t:'03:48', who:'You', side:'rep', text:'Not enough. I’m working on it — earlier nights this week.', tag:{k:'signal',l:'Honesty'} },
      { t:'05:15', who:'You', side:'rep', text:'Let’s do this properly — same time next week?', tag:{k:'pos',l:'Commitment'} },
      { t:'05:38', who:'Them', side:'cust', text:'I’d love that.' },
    ],
  ],
};

// build a deep-dive bound to the clicked recording (falls back to the sample transcript)
function buildDeepDive(rec, mode) {
  const fallback = window.LUMEN.transcript[mode];
  if (!rec) return fallback;
  const h = hashId(rec.id || rec.title);
  const pool = SCRIPTS[mode] || SCRIPTS.business;
  const lines = pool[h % pool.length];
  const sentMap = { pos: 0.38, neu: -0.02, neg: -0.32 };
  const sentiment = Math.max(-0.8, Math.min(0.8, (sentMap[rec.sent] ?? 0.12) + ((h % 7) - 3) / 100));
  const who = rec.person || rec.who || (mode === 'business' ? 'the other side' : 'them');
  const dur = rec.dur || (rec.durSec != null ? fmtDurS(rec.durSec) : '');
  const meta = [who, dur, rec.when].filter(Boolean).join(' · ');
  const title = rec.title || fallback.title;
  const lead = String(title).split('—')[0].trim();
  const tldr = mode === 'business'
    ? `${lead} is engaged${sentiment >= 0.2 ? ' and leaning in' : ', weighing real concerns'}. The clearest path forward is to address the open objection and lock a concrete next step while interest is high.`
    : `A ${sentiment >= 0.2 ? 'warm, open' : 'tense but honest'} conversation. The turning point was slowing down and asking instead of reacting — your tone softened from there.`;
  const actions = mode === 'business'
    ? ['Send a tailored follow-up referencing what mattered most', 'Confirm the next step on the calendar before end of week', 'Loop in a second stakeholder to de-risk the deal']
    : ['Notice the moment your tone shifted', 'Try the pause earlier next time', 'Revisit when rested — energy shapes the conversation'];
  const next = mode === 'business'
    ? 'Strike while sentiment is high: send the follow-up today and propose a specific time for the next conversation.'
    : 'You did the hard part. Next time, bring the calm you found at the end to the very start.';
  return { title, meta, tldr, sentiment, actions, next, lines };
}

function Conversation() {
  const { go, mode, showToast, viewConvo, convoFrom } = useApp();
  const t = React.useMemo(() => buildDeepDive(viewConvo, mode), [viewConvo, mode]);
  const [playing, setPlaying] = React.useState(false);
  const [prog, setProg] = React.useState(0.34);
  const [tab, setTab] = React.useState('all');
  const [expanded, setExpanded] = React.useState(false);
  const [doneItems, setDoneItems] = React.useState(()=>new Set());
  const totalSec = (viewConvo && (viewConvo.durSec || parseDur(viewConvo.dur))) || 1934;

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
        <button className="btn btn-icon btn-ghost" onClick={()=>go(convoFrom||'dashboard')} aria-label="Back"><Icon name="chevL" size={18} /></button>
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
                <span className="faint tnum" style={{ fontSize:12.5 }}>/ {fmt(totalSec)}</span>
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
