import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   SONARI — Recordings Library (Data): filters + playback + backup
   ============================================================ */
function rng(seed){ let s = seed * 9301 + 49297; return () => { s = (s*9301+49297) % 233280; return s/233280; }; }
const fmtDur = (s)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const SOURCE_META = {
  listen:{ label:'Live capture', icon:'mic',   color:'var(--viz-1)' },
  upload:{ label:'Upload',      icon:'upload', color:'var(--viz-3)' },
  drive: { label:'Google Drive',icon:'drive',  color:'#16a765' },
  voice: { label:'Voice memo',  icon:'mic',    color:'var(--viz-5)' },
  call:  { label:'Recorded call',icon:'wave',  color:'var(--viz-2)' },
};

function buildLibrary(mode) {
  const r = rng(mode === 'business' ? 42 : 73);
  const conf = mode === 'business'
    ? { sources:['listen','upload','drive'],
        titles:['Meridian Health — Pricing review','Atlas Logistics — Technical deep-dive','Brightwave — Discovery','Kepler Dynamics — Follow-up','Vertex Retail — Intro','Northstar — Renewal','Cobalt — Demo','Pinnacle — Negotiation','Standup — Sales team','Helix Corp — Discovery','Orbit Media — QBR','Summit — Procurement call'],
        people:['Dana R.','Sam K.','Priya M.','Theo V.','Lena W.','Omar H.'],
        tags:['Discovery','Proposal','Negotiation','Internal'] }
    : { sources:['listen','voice','call','upload'],
        titles:['Morning walk — thinking out loud','Hard conversation with Jordan','Weekly review','Call with Mom','Late-night journal','Standup reflection','Drive-home debrief','Therapy prep notes','Gratitude memo','Catch-up with Alex','Planning the week','Wind-down thoughts'],
        people:['Me','Jordan','Mom','Alex','Sam'],
        tags:['Reflection','Relationships','Health & rest','Work'] };
  const sents = ['pos','neu','neg'];
  const out = [];
  for (let i = 0; i < 16; i++) {
    const daysAgo = Math.floor(r() * 44); // up to 44 days → some beyond 30-day cap
    const durSec = 120 + Math.floor(r() * 2600);
    out.push({
      id: mode[0] + 'r' + i,
      title: conf.titles[i % conf.titles.length],
      source: conf.sources[Math.floor(r() * conf.sources.length)],
      durSec,
      daysAgo,
      person: conf.people[Math.floor(r() * conf.people.length)],
      tag: conf.tags[Math.floor(r() * conf.tags.length)],
      sent: sents[Math.floor(r() * 3)],
      starred: r() > 0.74,
      analyzed: r() > 0.28,
      seed: i + 3,
      sizeMB: (durSec / 60 * (0.9 + r())).toFixed(1),
    });
  }
  return out.sort((a,b)=>a.daysAgo-b.daysAgo);
}

function whenLabel(d){ return d===0?'Today':d===1?'Yesterday':d<7?`${d} days ago`:d<14?'Last week':d<31?`${Math.floor(d/7)} weeks ago`:`${Math.floor(d/30)} mo ago`; }

/* Plan-gated filter: shows a lock badge for the tier it needs */
function GatedFilter({ allowed, tier, icon, label, value, options, onChange, go, showToast }) {
  if (allowed) return <Dropdown icon={icon} label={label} value={value} options={options} onChange={onChange} />;
  const tl = tier==='premium' ? 'Premium' : 'Plus';
  return (
    <button className="chip gated" style={{ height:38 }} onClick={()=>{ showToast(`${label} filtering needs ${tl}`, 'spark'); go('pricing'); }} title={`Upgrade to ${tl} to use this filter`}>
      <Icon name={icon} size={15} />
      <span className="faint" style={{ fontWeight:500 }}>{label}</span>
      <span className="lock-pill" data-tier={tier}><Icon name="lock" size={9} />{tl}</span>
    </button>
  );
}

function Library() {
  const { mode, go, t, plan, planAllows, wiped, setWiped, showToast } = useApp();
  const baseAll = React.useMemo(()=>buildLibrary(mode), [mode]);
  const all = wiped ? [] : baseAll;
  const isBiz = mode === 'business';

  const [q, setQ] = React.useState('');
  const [date, setDate] = React.useState('all');
  const [cFrom, setCFrom] = React.useState('');
  const [cTo, setCTo] = React.useState('');
  const [source, setSource] = React.useState('all');
  const [person, setPerson] = React.useState('all');
  const [tag, setTag] = React.useState('all');
  const [sent, setSent] = React.useState('all');
  const [dur, setDur] = React.useState('all');
  const [starOnly, setStarOnly] = React.useState(false);
  const [playing, setPlaying] = React.useState(null);
  const [delOpen, setDelOpen] = React.useState(false);
  const [sel, setSel] = React.useState(()=>new Set());
  const selMode = sel.size > 0;
  const toggleSel = (id) => setSel(s => { const n = new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const isPremium = planAllows('premium');
  const canSelect = plan !== 'free';
  React.useEffect(()=>{ setSource('all'); setPerson('all'); setTag('all'); setSent('all'); setStarOnly(false); }, [mode]);

  const people = React.useMemo(()=>[...new Set(all.map(r=>r.person))], [all]);
  const tags = React.useMemo(()=>[...new Set(all.map(r=>r.tag))], [all]);
  const sources = React.useMemo(()=>[...new Set(all.map(r=>r.source))], [all]);

  const today = Date.now();
  const daysBetween = (iso) => (today - new Date(iso).getTime()) / 86400000;
  const dateOk = (d) => {
    if (date==='all') return true;
    if (date==='today') return d===0;
    if (date==='7') return d<7;
    if (date==='30') return d<31;
    if (date==='custom') {
      const lo = cFrom ? daysBetween(cFrom) : Infinity;
      const hi = cTo ? daysBetween(cTo) : 0;
      return d <= lo && d >= hi; // within [from..to]
    }
    return true;
  };
  const durOk = (s) => dur==='all' || (dur==='s'&&s<300) || (dur==='m'&&s>=300&&s<1200) || (dur==='l'&&s>=1200);
  const filtered = all.filter(r =>
    (!q || r.title.toLowerCase().includes(q.toLowerCase()) || r.person.toLowerCase().includes(q.toLowerCase())) &&
    dateOk(r.daysAgo) && durOk(r.durSec) &&
    (source==='all'||r.source===source) && (person==='all'||r.person===person) &&
    (tag==='all'||r.tag===tag) && (sent==='all'||r.sent===sent) && (!starOnly || r.starred)
  );

  const opt = (vals, meta) => [{value:'all',label:'All'}, ...vals.map(v=>({ value:v, label: meta?meta(v):v }))];
  // storage caps by plan: Free 2GB / Plus 30GB / Premium unlimited
  const capGB = plan==='premium' ? Infinity : plan==='plus' ? 30 : 2;
  const usedGB = wiped ? 0 : (isBiz ? 1.6 : 0.7);
  const anyFilter = date!=='all'||source!=='all'||person!=='all'||tag!=='all'||sent!=='all'||dur!=='all'||starOnly||q;
  const reset = ()=>{ setQ('');setDate('all');setSource('all');setPerson('all');setTag('all');setSent('all');setDur('all');setStarOnly(false); };

  return (
    <div className="page" style={{ paddingBottom: playing ? 120 : 64 }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-end', marginBottom:18, flexWrap:'wrap', gap:14 }}>
        <div className="stack" style={{ gap:6 }}>
          <span className="eyebrow">Your data · memory</span>
          <h1 className="display" style={{ fontSize:28, margin:0, whiteSpace:'nowrap' }}>Recordings</h1>
        </div>
        <div className="row" style={{ gap:10 }}>
          <span className="lib-backup"><span className="center" style={{ width:24, height:24, borderRadius:7, background:'var(--good-soft)', color:'var(--good)' }}><Icon name="check" size={14} stroke={2.6} /></span>Cloud backup · synced 4 min ago</span>
          <button className="btn btn-primary" onClick={()=>go('analyze')}><Icon name="plus" size={16} />Add</button>
        </div>
      </div>

      {/* storage + backup status */}
      <div className="grid g-2" style={{ marginBottom:'var(--gap)' }}>
        <div className="card card-pad">
          <div className="row" style={{ justifyContent:'space-between', marginBottom:10 }}>
            <span className="row" style={{ gap:8, fontWeight:650, fontSize:13.5 }}><Icon name="layers" size={16} />Storage used <span className="badge badge-neutral tcap" style={{ height:19 }}>{plan}</span></span>
            <span className="faint tnum" style={{ fontSize:12.5 }}>{usedGB} GB of {capGB===Infinity?'∞':capGB+' GB'}</span>
          </div>
          <div className="bar" style={{ height:9 }}><i style={{ width:`${capGB===Infinity?Math.min(18,usedGB):Math.min(100,usedGB/capGB*100)}%`, background: capGB!==Infinity && usedGB/capGB>0.85 ? 'var(--warn)' : 'var(--accent)' }} /></div>
          <div className="row" style={{ justifyContent:'space-between', marginTop:10 }}>
            <span className="faint" style={{ fontSize:12 }}>{plan==='premium'?'Unlimited storage':plan==='plus'?'30 GB included':'2 GB on Free · last 30 days'}</span>
            {plan!=='premium' && <button className="linkbtn" style={{ fontSize:12.5 }} onClick={()=>go('pricing')}>{plan==='free'?'Upgrade to 30 GB':'Go unlimited'}</button>}
          </div>
        </div>
        <div className="card card-pad" style={{ display:'flex', gap:13, alignItems:'center' }}>
          <span className="center" style={{ width:44, height:44, borderRadius:13, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name="refresh" size={22} /></span>
          <div className="stack grow" style={{ gap:2 }}>
            <span style={{ fontWeight:650, fontSize:14 }}>Auto-saving every 15 minutes</span>
            <span className="faint" style={{ fontSize:12.5, lineHeight:1.45 }}>While Listen mode is on, Kithra chunks and backs up audio to the cloud every 15 min — even when your phone is locked.</span>
          </div>
        </div>
      </div>

      {/* filters */}
      <div className="lib-toolbar">
        <div className="searchbox" style={{ flex:'1 1 200px', height:38 }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search recordings…" />
        </div>
        {/* FREE: date + custom range + length */}
        <Dropdown icon="calendar" label="Date" value={date} options={[{value:'all',label:'All time'},{value:'today',label:'Today'},{value:'7',label:'Last 7 days'},{value:'30',label:'Last 30 days'},{value:'custom',label:'Custom range…'}]} onChange={setDate} />
        <Dropdown icon="clock" label="Length" value={dur} options={[{value:'all',label:'Any'},{value:'s',label:'Under 5 min'},{value:'m',label:'5–20 min'},{value:'l',label:'20 min+'}]} onChange={setDur} />
        {/* PLUS: source, category, tone */}
        <GatedFilter allowed={planAllows('plus')} tier="plus" icon="layers" label="Source" value={source} options={opt(sources, v=>SOURCE_META[v].label)} onChange={setSource} go={go} showToast={showToast} />
        <GatedFilter allowed={planAllows('plus')} tier="plus" icon="filter" label="Category" value={tag} options={opt(tags)} onChange={setTag} go={go} showToast={showToast} />
        <GatedFilter allowed={planAllows('plus')} tier="plus" icon="heart" label="Tone" value={sent} options={[{value:'all',label:'Any'},{value:'pos',label:'Positive'},{value:'neu',label:'Neutral'},{value:'neg',label:'Tense'}]} onChange={setSent} go={go} showToast={showToast} />
        {/* PREMIUM: people & relationships */}
        <GatedFilter allowed={planAllows('premium')} tier="premium" icon="user" label={isBiz?'Person':'Relationship'} value={person} options={opt(people)} onChange={setPerson} go={go} showToast={showToast} />
        <button className={`chip ${starOnly?'is-on':''}`} style={{ height:38 }} onClick={()=>setStarOnly(s=>!s)}><Icon name="spark" size={15} />Starred</button>
      </div>

      {/* custom date range inputs */}
      {date==='custom' && (
        <div className="lib-custom anim-in">
          <span className="faint" style={{ fontSize:12.5, fontWeight:600 }}><Icon name="calendar" size={14} /> From</span>
          <input type="date" className="field" style={{ height:36, width:'auto' }} value={cFrom} onChange={e=>setCFrom(e.target.value)} />
          <span className="faint" style={{ fontSize:12.5, fontWeight:600 }}>to</span>
          <input type="date" className="field" style={{ height:36, width:'auto' }} value={cTo} onChange={e=>setCTo(e.target.value)} />
        </div>
      )}

      {/* AI auto-categorization banner */}
      <div className="lib-ai">
        <span className="center" style={{ width:30, height:30, borderRadius:9, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name="spark" size={16} /></span>
        <div className="stack grow" style={{ gap:1, minWidth:0 }}>
          <span style={{ fontWeight:650, fontSize:13 }}>{planAllows('plus')?'AI auto-categorized your recordings':'AI auto-categorization is a Plus feature'}</span>
          <span className="faint" style={{ fontSize:11.5, lineHeight:1.4 }}>Free includes Date &amp; Length. Source, category &amp; tone come with Plus; people &amp; relationships with Premium.</span>
        </div>
        {planAllows('plus')
          ? <span className="badge badge-good" style={{ flex:'none' }}><Icon name="check" size={12} stroke={2.6} />On</span>
          : <button className="btn btn-sm" style={{ flex:'none', background:'var(--viz-5)', color:'#fff' }} onClick={()=>go('pricing')}><Icon name="spark" size={13} />Upgrade</button>}
      </div>

      <div className="row" style={{ gap:10, margin:'4px 0 14px', flexWrap:'wrap' }}>
        <span className="faint" style={{ fontSize:12.5 }}><b className="tnum" style={{ color:'var(--ink)' }}>{filtered.length}</b> of {all.length} recordings</span>
        {anyFilter && <button className="chip" style={{ height:26, fontSize:12 }} onClick={reset}><Icon name="x" size={13} />Clear</button>}
        <div className="grow" />
        {all.length>0 && <button className="chip" style={{ height:26, fontSize:12 }} onClick={()=>setDelOpen(true)}><Icon name="trash" size={13} />Delete by date</button>}
      </div>

      {/* list */}
      <div className="card" style={{ overflow:'hidden' }}>
        {all.length===0 && (
          <div className="center" style={{ padding:'56px 20px' }}>
            <div className="stack center" style={{ gap:12, maxWidth:340, textAlign:'center' }}>
              <span className="center" style={{ width:52, height:52, borderRadius:16, background:'var(--surface-sunken)', color:'var(--ink-3)' }}><Icon name="trash" size={24} /></span>
              <span style={{ fontWeight:700, fontSize:15 }}>No recordings</span>
              <span className="muted" style={{ fontSize:13, lineHeight:1.5 }}>Your library is empty — recordings and their insights have been deleted. Capture something new to start again.</span>
              <button className="btn btn-primary btn-sm" onClick={()=>go('analyze')}><Icon name="plus" size={14} />Add a recording</button>
            </div>
          </div>
        )}
        {all.length>0 && filtered.length===0 && <div className="center" style={{ padding:'50px 20px' }}><div className="stack center" style={{ gap:10 }}><Icon name="search" size={24} /><span className="muted">No recordings match these filters.</span></div></div>}
        {filtered.map((r,i)=>{
          const sm = SOURCE_META[r.source];
          const isPlaying = playing && playing.id===r.id;
          const expired = r.daysAgo>=30;
          const checked = sel.has(r.id);
          return (
            <div key={r.id} className={`lib-row ${isPlaying?'on':''} ${checked?'sel':''}`}>
              {canSelect && (
                <button className={`lib-check ${checked?'on':''}`} onClick={()=>toggleSel(r.id)} aria-label="Select">
                  {checked && <Icon name="check" size={13} stroke={3} />}
                </button>
              )}
              <button className="lib-play" onClick={()=>setPlaying(isPlaying?null:r)} aria-label={isPlaying?'Pause':'Play'}>
                <Icon name={isPlaying?'pause':'play'} size={16} fill />
              </button>
              <div className="lib-wave"><Waveform bars={22} seed={r.seed} height={30} gap={2} color={isPlaying?'var(--accent)':'var(--line-2)'} /></div>
              <button className="stack grow lib-open" style={{ gap:3, minWidth:0, textAlign:'left' }}
                onClick={()=> isPremium ? go('conversation',{convo:r.id}) : (r.analyzed ? go('conversation',{convo:r.id}) : go('pricing'))}
                title={isPremium?'Open insights for this recording':''}>
                <div className="row" style={{ gap:8, minWidth:0 }}>
                  <span style={{ fontWeight:650, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</span>
                  {r.starred && <Icon name="spark" size={13} fill style={{ color:'var(--viz-3)', flex:'none' }} />}
                </div>
                <div className="row wrap" style={{ gap:9 }}>
                  <span className="lib-meta"><span style={{ color:sm.color }}><Icon name={sm.icon} size={12} /></span>{sm.label}</span>
                  <span className="lib-meta tnum">{fmtDur(r.durSec)}</span>
                  <span className="lib-meta">{whenLabel(r.daysAgo)}</span>
                  <span className="lib-meta">{r.person}</span>
                  <span className="tag" style={{ height:20, fontSize:10.5 }}>{r.tag}</span>
                </div>
              </button>
              <div className="stack" style={{ alignItems:'flex-end', gap:5, flex:'none' }}>
                <SentDot s={r.sent} />
                {expired
                  ? <span className="lib-meta" style={{ color:'var(--warn)' }} title="Beyond free 30-day window"><Icon name="clock" size={12} />Expiring</span>
                  : <span className="lib-meta" title="Backed up to cloud"><Icon name="check" size={12} stroke={2.6} />Backed up</span>}
              </div>
              {isPremium ? (
                <div className="row" style={{ gap:6, flex:'none' }}>
                  <button className="btn btn-soft btn-sm btn-icon" title="Download recording" onClick={()=>showToast(`Downloading “${r.title}”…`,'download')}><Icon name="download" size={15} /></button>
                  <button className="btn btn-soft btn-sm btn-icon" title="Talk about this recording" onClick={()=>{ showToast(`Opening agent for “${r.title}”`,'mic'); go('ask'); }}><Icon name="mic" size={15} /></button>
                  <button className="btn btn-soft btn-sm" onClick={()=>go('conversation',{convo:r.id})}>Insights<Icon name="chevR" size={14} /></button>
                </div>
              ) : (
                <div className="row" style={{ gap:6, flex:'none' }}>
                  <button className="btn btn-soft btn-sm btn-icon" title="Download recording" onClick={()=>showToast(`Downloading “${r.title}”…`,'download')}><Icon name="download" size={15} /></button>
                  <button className="btn btn-soft btn-sm" onClick={()=> r.analyzed ? go('conversation',{convo:r.id}) : go('pricing')}>
                    {r.analyzed ? <>Insights<Icon name="chevR" size={14} /></> : <><Icon name="lock" size={13} />Analyze</>}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* multi-select action bar (Plus+) */}
      {selMode && (
        <div className="lib-selbar">
          <span style={{ fontWeight:700, fontSize:13.5 }}><span className="tnum">{sel.size}</span> selected</span>
          <button className="linkbtn" style={{ fontSize:12.5 }} onClick={()=>setSel(new Set())}>Clear</button>
          <div className="grow" />
          <button className="btn btn-soft btn-sm" onClick={()=>showToast(`Downloading ${sel.size} recordings (.zip)…`,'download')}><Icon name="download" size={15} />Download</button>
          <button className="btn btn-soft btn-sm" onClick={()=> isPremium ? (showToast(`Asking the live agent across ${sel.size} recordings…`,'chat'), go('ask')) : (showToast('Multi-recording agent needs Premium','spark'), go('pricing'))}><Icon name="chat" size={15} />Ask agent{!isPremium && <span className="lock-pill" style={{ marginLeft:2 }}>Premium</span>}</button>
          <button className="btn btn-primary btn-sm" onClick={()=> isPremium ? (showToast(`Generating insights across ${sel.size} recordings…`,'spark'), go('conversation')) : (showToast('Cross-recording insights need Premium','spark'), go('pricing'))}><Icon name="spark" size={15} />Insights{!isPremium && <span className="lock-pill" style={{ marginLeft:2, background:'rgba(255,255,255,.25)', color:'#fff' }}>Premium</span>}</button>
        </div>
      )}

      {/* sticky player */}
      {playing && <LibPlayer rec={playing} onClose={()=>setPlaying(null)} go={go} />}

      {/* date-scoped delete modal */}
      {delOpen && <DeleteModal onClose={()=>setDelOpen(false)} onConfirm={(label)=>{ setDelOpen(false); setWiped(true); setSel(new Set()); showToast(`Deleted recordings — ${label}`, 'trash'); }} />}
    </div>
  );
}

function DeleteModal({ onClose, onConfirm }) {
  const [scope, setScope] = React.useState('7');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const opts = [
    { k:'7', label:'Last 7 days' },
    { k:'30', label:'Last 30 days' },
    { k:'custom', label:'Custom date range' },
    { k:'all', label:'Everything' },
  ];
  const label = scope==='custom' ? (from||to ? `${from||'start'} → ${to||'now'}` : 'custom range') : opts.find(o=>o.k===scope).label.toLowerCase();
  return (
    <div className="lc-overlay" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="lc-card card" style={{ width:'min(440px,94vw)' }}>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:6 }}>
          <span className="badge badge-bad" style={{ height:26 }}><Icon name="trash" size={13} />Delete recordings</span>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <h2 className="display" style={{ fontSize:22, margin:'6px 0 4px' }}>Which recordings should we delete?</h2>
        <p className="muted" style={{ margin:'0 0 16px', fontSize:13.5, lineHeight:1.5 }}>Pick a date range. This permanently removes the audio, transcripts, and their insights — it can’t be undone.</p>
        <div className="stack" style={{ gap:8, marginBottom:14 }}>
          {opts.map(o=>(
            <button key={o.k} className={`del-opt ${scope===o.k?'on':''}`} onClick={()=>setScope(o.k)}>
              <span className={`del-radio ${scope===o.k?'on':''}`}>{scope===o.k && <i />}</span>
              <span style={{ fontWeight:600, fontSize:14 }}>{o.label}</span>
            </button>
          ))}
        </div>
        {scope==='custom' && (
          <div className="lib-custom" style={{ marginBottom:14 }}>
            <span className="faint" style={{ fontSize:12.5, fontWeight:600 }}>From</span>
            <input type="date" className="field" style={{ height:36, width:'auto' }} value={from} onChange={e=>setFrom(e.target.value)} />
            <span className="faint" style={{ fontSize:12.5, fontWeight:600 }}>to</span>
            <input type="date" className="field" style={{ height:36, width:'auto' }} value={to} onChange={e=>setTo(e.target.value)} />
          </div>
        )}
        <div className="row" style={{ gap:10 }}>
          <button className="btn btn-ghost btn-lg grow" onClick={onClose}>Cancel</button>
          <button className="btn btn-lg grow" style={{ background:'var(--bad)', color:'#fff' }} onClick={()=>onConfirm(label)}><Icon name="trash" size={17} />Delete {scope==='all'?'everything':'these'}</button>
        </div>
      </div>
    </div>
  );
}

function LibPlayer({ rec, onClose, go }) {
  const [prog, setProg] = React.useState(0);
  const [on, setOn] = React.useState(true);
  React.useEffect(()=>{ setProg(0); setOn(true); }, [rec.id]);
  React.useEffect(()=>{
    if(!on) return;
    let raf, last=performance.now();
    const tick=(now)=>{ const dt=(now-last)/1000; last=now;
      setProg(p=>{ const n=p+dt/rec.durSec; if(n>=1){ setOn(false); return 1; } return n; });
      raf=requestAnimationFrame(tick); };
    raf=requestAnimationFrame(tick); return ()=>cancelAnimationFrame(raf);
  }, [on, rec.id]);
  const sm = SOURCE_META[rec.source];
  return (
    <div className="lib-player">
      <button className="lib-play lg" onClick={()=>setOn(o=>!o)} aria-label={on?'Pause':'Play'}><Icon name={on?'pause':'play'} size={18} fill /></button>
      <div className="stack" style={{ gap:2, minWidth:0, width:170, flex:'none' }}>
        <span style={{ fontWeight:650, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{rec.title}</span>
        <span className="lib-meta"><span style={{ color:sm.color }}><Icon name={sm.icon} size={11} /></span>{sm.label}</span>
      </div>
      <div className="grow" style={{ minWidth:0 }}><Waveform bars={84} seed={rec.seed} height={34} gap={2} progress={prog} /></div>
      <span className="tnum faint" style={{ fontSize:12, flex:'none', width:88, textAlign:'right' }}>{fmtDur(prog*rec.durSec)} / {fmtDur(rec.durSec)}</span>
      <button className="btn btn-soft btn-sm" style={{ flex:'none' }} onClick={()=> rec.analyzed ? go('conversation') : go('pricing')}>{rec.analyzed?'Open':'Analyze'}</button>
      <button className="btn btn-icon btn-ghost btn-sm" style={{ flex:'none' }} onClick={onClose} aria-label="Close"><Icon name="x" size={15} /></button>
    </div>
  );
}

function ExportModal({ onClose, onConfirm }) {
  const [content, setContent] = React.useState('both');
  const [scope, setScope] = React.useState('7');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const contents = [
    { k:'summary', label:'Summaries only', ic:'spark' },
    { k:'transcript', label:'Full transcripts', ic:'file' },
    { k:'both', label:'Summaries + transcripts', ic:'layers' },
  ];
  const ranges = [['3','Last 3 days'],['7','Last 7 days'],['30','Last 30 days'],['custom','Custom range'],['all','Everything']];
  const rlabel = scope==='custom' ? (from||to ? `${from||'start'} → ${to||'now'}` : 'custom range') : ranges.find(r=>r[0]===scope)[1].toLowerCase();
  const clabel = contents.find(c=>c.k===content).label.toLowerCase();
  return (
    <div className="lc-overlay" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="lc-card card" style={{ width:'min(460px,94vw)' }}>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:6 }}>
          <span className="badge badge-accent" style={{ height:26 }}><Icon name="download" size={13} />Export as PDF</span>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <h2 className="display" style={{ fontSize:22, margin:'6px 0 4px' }}>What should we include?</h2>
        <p className="muted" style={{ margin:'0 0 14px', fontSize:13.5, lineHeight:1.5 }}>Choose what to put in the PDF and the date range to cover.</p>

        <span className="eyebrow" style={{ display:'block', marginBottom:8 }}>Content</span>
        <div className="stack" style={{ gap:8, marginBottom:16 }}>
          {contents.map(c=>(
            <button key={c.k} className={`del-opt ${content===c.k?'on-accent':''}`} onClick={()=>setContent(c.k)} style={content===c.k?{borderColor:'var(--accent)',background:'var(--accent-soft)'}:undefined}>
              <span className="center" style={{ width:30, height:30, borderRadius:9, background:'var(--surface-2)', color:'var(--accent-strong)', flex:'none' }}><Icon name={c.ic} size={15} /></span>
              <span style={{ fontWeight:600, fontSize:14 }} className="grow">{c.label}</span>
              {content===c.k && <Icon name="check" size={16} stroke={2.6} style={{ color:'var(--accent-strong)' }} />}
            </button>
          ))}
        </div>

        <span className="eyebrow" style={{ display:'block', marginBottom:8 }}>Date range</span>
        <div className="row wrap" style={{ gap:8, marginBottom:12 }}>
          {ranges.map(r=>(
            <button key={r[0]} className={`chip ${scope===r[0]?'is-on':''}`} onClick={()=>setScope(r[0])}>{r[1]}</button>
          ))}
        </div>
        {scope==='custom' && (
          <div className="lib-custom" style={{ marginBottom:14 }}>
            <span className="faint" style={{ fontSize:12.5, fontWeight:600 }}>From</span>
            <input type="date" className="field" style={{ height:36, width:'auto' }} value={from} onChange={e=>setFrom(e.target.value)} />
            <span className="faint" style={{ fontSize:12.5, fontWeight:600 }}>to</span>
            <input type="date" className="field" style={{ height:36, width:'auto' }} value={to} onChange={e=>setTo(e.target.value)} />
          </div>
        )}
        <div className="row" style={{ gap:10, marginTop:4 }}>
          <button className="btn btn-ghost btn-lg grow" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-lg grow" onClick={()=>onConfirm(`${clabel}, ${rlabel}`)}><Icon name="download" size={17} />Generate PDF</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Library, SOURCE_META, DeleteModal, ExportModal });

export { Library, SOURCE_META, DeleteModal, ExportModal };
