import React from 'react';
import { Icon, RealPlayer, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   KITHRA — Recordings: YOUR real library (no sample data)
   Everything here is audio you actually recorded or uploaded.
   ============================================================ */
const fmtDur = (s)=>`${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,'0')}`;
const SOURCE_META = {
  listen:{ label:'Recorded live', icon:'mic',   color:'var(--viz-1)' },
  upload:{ label:'Upload',       icon:'upload', color:'var(--viz-3)' },
  drive: { label:'Google Drive', icon:'drive',  color:'#16a765' },
  voice: { label:'Voice memo',   icon:'mic',    color:'var(--viz-5)' },
  call:  { label:'Recorded call',icon:'wave',   color:'var(--viz-2)' },
};
function whenLabel(ts){
  if(!ts) return '';
  const d = Math.floor((Date.now()-ts)/86400000);
  return d<=0?'Today':d===1?'Yesterday':d<7?`${d} days ago`:new Date(ts).toLocaleDateString();
}

function Library() {
  const { go, user, clips, removeClip, setViewClip, showToast } = useApp();
  const [q, setQ] = React.useState('');
  const [dur, setDur] = React.useState('all');
  const [confirmId, setConfirmId] = React.useState(null);

  const durOk = (s)=> dur==='all' || (dur==='s'&&s<300) || (dur==='m'&&s>=300&&s<1200) || (dur==='l'&&s>=1200);
  const filtered = (clips||[]).filter(c =>
    (!q || (c.name||'').toLowerCase().includes(q.toLowerCase()) || (c.transcript||'').toLowerCase().includes(q.toLowerCase())) &&
    durOk(c.durSec||0)
  );
  const totalMin = Math.round((clips||[]).reduce((a,c)=>a+(c.durSec||0),0)/60);
  const transcribed = (clips||[]).filter(c=>c.transcript).length;

  const download = (c) => {
    if (!c.url) { showToast('Audio for this one lives on the device it was recorded on','shield'); return; }
    const a = document.createElement('a'); a.href = c.url; a.download = (c.name||'kithra-recording') + '';
    document.body.appendChild(a); a.click(); a.remove();
    showToast('Downloading recording','download');
  };
  const del = async (c) => {
    removeClip(c.id);
    try { if (window.KithraCloud && window.KithraCloud.configured()) await window.KithraCloud.deleteRecording(c.id); } catch(e){}
    setConfirmId(null); showToast('Recording deleted','trash');
  };

  return (
    <div className="page">
      <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-end', marginBottom:18, flexWrap:'wrap', gap:14 }}>
        <div className="stack" style={{ gap:6 }}>
          <span className="eyebrow">Your data · memory</span>
          <h1 className="display" style={{ fontSize:28, margin:0, whiteSpace:'nowrap' }}>Recordings</h1>
        </div>
        <div className="row" style={{ gap:10, flexWrap:'wrap' }}>
          {user
            ? <span className="lib-backup"><span className="center" style={{ width:24, height:24, borderRadius:7, background:'var(--good-soft)', color:'var(--good)' }}><Icon name="check" size={14} stroke={2.6} /></span>Synced to {user.email}</span>
            : <span className="lib-backup"><span className="center" style={{ width:24, height:24, borderRadius:7, background:'var(--surface-sunken)', color:'var(--ink-3)' }}><Icon name="shield" size={13} /></span>On this device only</span>}
          <button className="btn btn-primary" onClick={()=>go('analyze')}><Icon name="plus" size={16} />Record / upload</button>
        </div>
      </div>

      {/* real stats */}
      <div className="grid g-3" style={{ marginBottom:'var(--gap)' }}>
        {[
          ['layers','Recordings', String((clips||[]).length)],
          ['clock','Minutes captured', String(totalMin)],
          ['file','Transcribed', `${transcribed} of ${(clips||[]).length}`],
        ].map((m,i)=>(
          <div key={i} className="card card-pad metric">
            <span className="label"><Icon name={m[0]} size={15} />{m[1]}</span>
            <div className="val"><span className="metric-num n" style={{ fontSize:30 }}>{m[2]}</span></div>
          </div>
        ))}
      </div>

      {/* working filters */}
      <div className="lib-toolbar" style={{ marginBottom:'var(--gap)' }}>
        <div className="searchbox" style={{ flex:'1 1 220px', height:38 }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search names & transcripts…" />
        </div>
        <Dropdown icon="clock" label="Length" value={dur} options={[{value:'all',label:'Any'},{value:'s',label:'Under 5 min'},{value:'m',label:'5–20 min'},{value:'l',label:'20 min+'}]} onChange={setDur} />
        <span className="badge badge-neutral" style={{ height:38 }}><Icon name="wave" size={13} />{filtered.length} shown</span>
      </div>

      {/* list — every row is REAL and really plays */}
      {(clips||[]).length===0 ? (
        <div className="card center" style={{ padding:'64px 20px' }}>
          <div className="stack center" style={{ gap:14, maxWidth:400, textAlign:'center' }}>
            <span className="center" style={{ width:58, height:58, borderRadius:18, background:'var(--accent-soft)', color:'var(--accent-strong)' }}><Icon name="mic" size={27} /></span>
            <h3 className="display" style={{ fontSize:22, margin:0 }}>No recordings yet</h3>
            <p className="muted" style={{ margin:0, fontSize:14, lineHeight:1.55 }}>Record a thought or upload a call — Kithra analyzes it on-device, and it shows up here as your real library. Where talk becomes insight.</p>
            <button className="btn btn-primary btn-lg" onClick={()=>go('analyze')}><Icon name="mic" size={18} />Make your first recording</button>
          </div>
        </div>
      ) : filtered.length===0 ? (
        <div className="card center" style={{ padding:'50px 20px' }}><div className="stack center" style={{ gap:10 }}><Icon name="search" size={24} /><span className="muted">Nothing matches that search.</span></div></div>
      ) : (
        <div className="stack" style={{ gap:12 }}>
          {filtered.map(c=>{
            const a = c.analysis || {};
            const sm = SOURCE_META[c.source] || SOURCE_META.upload;
            return (
              <div key={c.id} className="card" style={{ padding:'14px 16px' }}>
                <div className="row" style={{ justifyContent:'space-between', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                  <div className="stack" style={{ gap:3, minWidth:0 }}>
                    <span className="row" style={{ gap:8, minWidth:0 }}>
                      <button className="linkbtn" style={{ fontWeight:700, fontSize:14.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'left', border:0, background:'transparent', padding:0, cursor:'pointer', color:'inherit' }} onClick={()=>go('conversation',{convo:c.id, from:'library', rec:c})} title="Open this recording — view insights & transcribe">{c.name||'Recording'}</button>
                      {c.transcript ? <Badge kind="good">Transcribed</Badge> : <Badge kind="neutral">Audio only</Badge>}
                    </span>
                    <span className="row wrap" style={{ gap:9 }}>
                      <span className="lib-meta"><span style={{ color:sm.color }}><Icon name={sm.icon} size={12} /></span>{sm.label}</span>
                      <span className="lib-meta tnum">{fmtDur(c.durSec)}</span>
                      <span className="lib-meta">{whenLabel(c.ts)}</span>
                      {a.wpm!=null && <span className="lib-meta tnum">{a.wpm} wpm</span>}
                      {a.talkRatio!=null && <span className="lib-meta tnum">{Math.round(a.talkRatio*100)}% voice</span>}
                    </span>
                  </div>
                  <div className="row" style={{ gap:6, flex:'none', flexWrap:'wrap' }}>
                    <button className="btn btn-soft btn-sm" title="Ask Kithra about this recording" onClick={()=>go('ask',{ask:c})}><Icon name="chat" size={14} />Ask</button>
                    <button className="btn btn-soft btn-sm" onClick={()=>go('conversation',{convo:c.id, from:'library', rec:c})}><Icon name="spark" size={14} />Insights</button>
                    {c.url && <button className="btn btn-soft btn-sm btn-icon" aria-label="Download audio" title="Download audio" onClick={()=>download(c)}><Icon name="download" size={15} /></button>}
                    {confirmId===c.id
                      ? <span className="row" style={{ gap:6 }}>
                          <button className="btn btn-sm" style={{ background:'var(--bad)', color:'#fff' }} onClick={()=>del(c)}>Delete</button>
                          <button className="btn btn-ghost btn-sm" onClick={()=>setConfirmId(null)}>Keep</button>
                        </span>
                      : <button className="btn btn-soft btn-sm btn-icon" aria-label="Delete recording" title="Delete recording" onClick={()=>setConfirmId(c.id)}><Icon name="trash" size={15} /></button>}
                  </div>
                </div>
                {c.url
                  ? <RealPlayer src={c.url} peaks={a.peaks||c.peaks} durSec={c.durSec} />
                  : <div className="row" style={{ gap:9, padding:'10px 12px', borderRadius:'var(--r-ctrl)', background:'var(--surface-2)', border:'1px dashed var(--line)' }}>
                      <Icon name="shield" size={15} style={{ color:'var(--ink-3)' }} />
                      <span className="faint" style={{ fontSize:12.5 }}>Audio stayed on the device where it was recorded — metadata{c.transcript?' & transcript':''} synced to your account.</span>
                    </div>}
                {c.transcript && <p className="faint" style={{ margin:'10px 0 0', fontSize:12.5, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{c.transcript}</p>}
              </div>
            );
          })}
        </div>
      )}
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
      <button className="btn btn-soft btn-sm" style={{ flex:'none' }} onClick={()=> rec.analyzed ? go('conversation',{convo:rec.id, from:'library', rec}) : go('pricing')}>{rec.analyzed?'Open':'Analyze'}</button>
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
