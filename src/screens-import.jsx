import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   LUMEN — Import / Connect Sources
   ============================================================ */
const INTEGRATIONS = [
  { k:'drive',  name:'Google Drive', icon:'drive', color:'#16a765', desc:'Import audio files stored in Drive' },
];
const SAMPLE_NAMES = {
  business:['Vertex-Retail-intro.m4a','Northstar-renewal.mp3','Cobalt-demo-call.wav','Pinnacle-negotiation.m4a'],
  personal:['Evening-reflection.m4a','Walk-and-talk.m4a','Call-with-Sam.mp3','Sunday-journal.wav'],
};

function useImport() {
  const { flow, mode } = useApp();
  const { files, setFiles, connections, setConnections } = flow;
  const addFile = () => {
    const pool = SAMPLE_NAMES[mode];
    const name = pool[files.length % pool.length];
    const dur = `${10+Math.floor(Math.random()*40)}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}`;
    setFiles(f => [{ name, dur, size:`${15+Math.floor(Math.random()*50)} MB`, status:'queued', fresh:true }, ...f]);
  };
  const connect = (k) => setConnections(c => ({ ...c, [k]: !c[k] }));
  return { files, setFiles, connections, connect, addFile };
}

function ImportBody({ compact }) {
  const { connections, connect, addFile, files, setFiles } = useImport();
  const [drag, setDrag] = React.useState(false);
  return (
    <>
      <div
        className={`dropzone anim-up ${drag?'drag':''}`}
        onClick={addFile}
        onDragOver={e=>{e.preventDefault();setDrag(true);}}
        onDragLeave={()=>setDrag(false)}
        onDrop={e=>{e.preventDefault();setDrag(false);addFile();}}>
        <div className="dz-ic"><Icon name="upload" size={28} /></div>
        <h3 className="display" style={{ fontSize:22, margin:'0 0 6px' }}>Drop in your audio</h3>
        <p className="muted" style={{ margin:'0 auto 16px', maxWidth:380, fontSize:14, lineHeight:1.5 }}>
          Drag files here or click to browse. MP3, M4A, WAV — calls, meetings, voice memos. Add supporting documents too.
        </p>
        <div className="row" style={{ gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <span className="btn btn-primary btn-sm"><Icon name="mic" size={15} />Add audio</span>
          <span className="btn btn-soft btn-sm"><Icon name="file" size={15} />Add documents</span>
        </div>
        <div style={{ marginTop:18, opacity:0.7 }}><Waveform bars={40} seed={9} height={26} gap={3} color="var(--line-2)" /></div>
      </div>

      <div style={{ marginTop:'var(--gap)' }}>
        <div className="sec-title"><div className="stack" style={{ gap:2 }}><h3>Import audio files</h3><span className="sub">Live capture is your main source — optionally import existing files too.</span></div></div>
        <div className="int-grid">
          {INTEGRATIONS.map(it=>{
            const on = connections[it.k];
            return (
              <div key={it.k} className="int-card">
                <span className="int-logo" style={{ background:it.color }}><Icon name={it.icon} size={22} /></span>
                <div className="stack grow" style={{ gap:2, minWidth:0 }}>
                  <span style={{ fontWeight:650, fontSize:14 }}>{it.name}</span>
                  <span className="faint" style={{ fontSize:12 }}>{on?'Connected · ready to import':it.desc}</span>
                </div>
                <button className={`btn btn-sm ${on?'btn-soft':'btn-ghost'}`} onClick={()=>connect(it.k)}>
                  {on ? <><Icon name="check" size={14} stroke={2.6} />Connected</> : 'Connect'}
                </button>
              </div>
            );
          })}
          <div className="int-card" style={{ background:'var(--accent-soft)', border:'1px solid color-mix(in srgb,var(--accent) 18%,transparent)' }}>
            <span className="int-logo" style={{ background:'var(--accent)' }}><Icon name="mic" size={22} /></span>
            <div className="stack grow" style={{ gap:2, minWidth:0 }}>
              <span style={{ fontWeight:650, fontSize:14 }}>Live capture</span>
              <span className="faint" style={{ fontSize:12 }}>Your always-on source — no integrations needed</span>
            </div>
            <span className="badge badge-good" style={{ flex:'none' }}>Primary</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop:'var(--gap)' }}>
        <div className="sec-title">
          <div className="stack" style={{ gap:2 }}><h3>In your library</h3><span className="sub">{files.length} items</span></div>
          <PrivacyChip text="Encrypted on upload" />
        </div>
        <div>
          {files.map((f,i)=>(
            <div key={i} className="file-row" style={f.fresh?{ animation:'popIn .35s var(--ease) both' }:undefined}>
              <span className="center" style={{ width:38, height:38, borderRadius:10, background:'var(--surface-2)', border:'1px solid var(--line)', color:'var(--ink-2)', flex:'none' }}>
                <Icon name={f.doc?'file':'wave'} size={18} />
              </span>
              <div className="stack grow" style={{ gap:2, minWidth:0 }}>
                <span style={{ fontWeight:600, fontSize:13.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                <span className="faint" style={{ fontSize:12 }}>{f.dur} · {f.size}</span>
              </div>
              <StatusPill status={f.status} />
              <button className="btn btn-icon btn-ghost btn-sm" aria-label="Remove" onClick={()=>setFiles(prev=>prev.filter((_,j)=>j!==i))}><Icon name="x" size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---- full-screen flow version ---- */
function ImportSources() {
  const { t, setTweak, go } = useApp();
  return (
    <div className="ob scroll" style={{ height:'100%', overflowY:'auto', background:'var(--paper)' }}>
      <header className="ob-top">
        <button className="row click" style={{ gap:9, background:'none', border:0 }} onClick={()=>go('onboarding')}>
          <LumenMark size={28} /><span style={{ fontFamily:'var(--font-display)', fontSize:19, fontWeight:600 }}>Kithra</span>
        </button>
        <div className="ob-steps">
          <span className="ob-step on">Intent</span><span className="ob-line" />
          <span className="ob-step on">Import</span><span className="ob-line" />
          <span className="ob-step">Insights</span>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={()=>setTweak('theme', t.theme==='dark'?'light':'dark')} aria-label="Theme"><Icon name={t.theme==='dark'?'sun':'moon'} size={18} /></button>
      </header>
      <main className="imp-wrap">
        <div className="anim-up" style={{ marginBottom:26 }}>
          <h1 className="display" style={{ fontSize:'clamp(28px,3.6vw,42px)', margin:0 }}>Bring in your recordings</h1>
          <p className="muted" style={{ fontSize:16, margin:'12px 0 0', maxWidth:560, lineHeight:1.55 }}>
            Add as little as one conversation or as many as a thousand. Kithra handles the rest.
          </p>
        </div>
        <ImportBody />
        <div className="ob-actions">
          <button className="btn btn-ghost btn-lg" onClick={()=>go('onboarding')}>Back</button>
          <button className="btn btn-primary btn-lg" onClick={()=>go('processing')}>Analyze my recordings <Icon name="arrowR" size={18} /></button>
        </div>
      </main>
    </div>
  );
}

/* ---- in-app panel version ---- */
function SourcesPanel() {
  const { go } = useApp();
  return (
    <div className="page">
      <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-end', marginBottom:22, flexWrap:'wrap', gap:14 }}>
        <div className="stack" style={{ gap:6 }}>
          <span className="eyebrow">Your data</span>
          <h1 className="display" style={{ fontSize:28, margin:0, whiteSpace:'nowrap' }}>Sources & library</h1>
        </div>
        <button className="btn btn-primary" onClick={()=>go('processing')}><Icon name="refresh" size={16} />Re-analyze</button>
      </div>
      <ImportBody compact />
    </div>
  );
}

Object.assign(window, { ImportSources, SourcesPanel, ImportBody });


export { ImportSources, SourcesPanel, ImportBody };
