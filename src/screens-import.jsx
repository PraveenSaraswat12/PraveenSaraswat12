import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   KITHRA — Sources: honest version
   Today: record live or upload files (both real, on-device).
   Meeting integrations are roadmap — labelled as such, no fake
   toggles pretending to connect.
   ============================================================ */
function ImportBody({ compact }) {
  const { go } = useApp();
  const roadmap = [
    { ic:'google', name:'Google Meet',  d:'Pull meeting recordings automatically' },
    { ic:'zoom',   name:'Zoom',         d:'Sync cloud recordings after each call' },
    { ic:'teams',  name:'Microsoft Teams', d:'Import call recordings via Graph' },
    { ic:'drive',  name:'Google Drive', d:'Watch a folder for new audio files' },
  ];
  return (
    <div className="stack" style={{ gap:'var(--gap)' }}>
      {/* what works today — for real */}
      <div className="grid g-2" style={{ gap:'var(--gap)' }}>
        <button className="card card-pad click stack" style={{ gap:10, textAlign:'left', alignItems:'flex-start', border:'1px solid color-mix(in srgb,var(--accent) 28%,transparent)' }} onClick={()=>go('analyze')}>
          <span className="center" style={{ width:44, height:44, borderRadius:13, background:'var(--accent)', color:'var(--accent-ink)' }}><Icon name="mic" size={21} /></span>
          <span style={{ fontWeight:700, fontSize:15.5 }}>Record live</span>
          <span className="muted" style={{ fontSize:13, lineHeight:1.5 }}>Capture from your microphone and get an instant on-device analysis.</span>
          <span className="badge badge-good" style={{ marginTop:2 }}><Icon name="check" size={11} stroke={2.6} />Works now</span>
        </button>
        <button className="card card-pad click stack" style={{ gap:10, textAlign:'left', alignItems:'flex-start', border:'1px solid color-mix(in srgb,var(--accent) 28%,transparent)' }} onClick={()=>go('analyze')}>
          <span className="center" style={{ width:44, height:44, borderRadius:13, background:'var(--accent-soft)', color:'var(--accent-strong)' }}><Icon name="upload" size={21} /></span>
          <span style={{ fontWeight:700, fontSize:15.5 }}>Upload audio</span>
          <span className="muted" style={{ fontSize:13, lineHeight:1.5 }}>MP3, WAV, M4A or OGG — calls, voice memos, meetings.</span>
          <span className="badge badge-good" style={{ marginTop:2 }}><Icon name="check" size={11} stroke={2.6} />Works now</span>
        </button>
      </div>

      {/* roadmap — labelled honestly */}
      <div className="card card-pad">
        <div className="row" style={{ justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <span style={{ fontWeight:700, fontSize:14.5 }}>Meeting integrations</span>
          <span className="badge badge-neutral"><Icon name="clock" size={12} />On the roadmap</span>
        </div>
        <div className="stack" style={{ gap:10 }}>
          {roadmap.map((r,i)=>(
            <div key={i} className="row" style={{ gap:12, padding:'10px 12px', borderRadius:'var(--r-ctrl)', background:'var(--surface-2)', border:'1px solid var(--line)', opacity:.8 }}>
              <span className="center" style={{ width:36, height:36, borderRadius:10, background:'var(--surface)', border:'1px solid var(--line)', flex:'none' }}><Icon name={r.ic} size={18} /></span>
              <div className="stack grow" style={{ gap:1 }}>
                <span style={{ fontWeight:650, fontSize:13.5 }}>{r.name}</span>
                <span className="faint" style={{ fontSize:12 }}>{r.d}</span>
              </div>
              <span className="tag" style={{ height:22, fontSize:10.5, flex:'none' }}>Coming soon</span>
            </div>
          ))}
        </div>
        <p className="faint" style={{ margin:'12px 0 0', fontSize:12, lineHeight:1.5 }}>We don’t show fake “connect” buttons. When these ship they’ll use real OAuth and appear here first.</p>
      </div>
    </div>
  );
}

function ImportSources() {
  const { go } = useApp();
  return (
    <div className="scroll" style={{ minHeight:'100%', overflow:'auto', background:'var(--paper)' }}>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'30px clamp(16px,4vw,36px) 60px' }}>
        <div className="row" style={{ gap:12, marginBottom:22 }}>
          <button className="btn btn-icon btn-ghost" onClick={()=>go('onboarding')} aria-label="Back"><Icon name="chevL" size={18} /></button>
          <Wordmark size={28} />
        </div>
        <div className="stack" style={{ gap:6, marginBottom:22 }}>
          <span className="eyebrow">Step 2 · Bring in audio</span>
          <h1 className="display" style={{ fontSize:'clamp(24px,3.4vw,32px)', margin:0 }}>Add your first conversation</h1>
        </div>
        <ImportBody />
        <div className="row" style={{ gap:10, marginTop:24 }}>
          <button className="btn btn-primary btn-lg" onClick={()=>go('analyze')}>Start with a recording <Icon name="arrowR" size={17} /></button>
          <button className="btn btn-ghost btn-lg" onClick={()=>go('dashboard')}>Skip for now</button>
        </div>
      </div>
    </div>
  );
}

function SourcesPanel() {
  return (
    <div className="page">
      <div className="stack" style={{ gap:6, marginBottom:22 }}>
        <span className="eyebrow">Your data</span>
        <h1 className="display" style={{ fontSize:28, margin:0 }}>Sources</h1>
      </div>
      <ImportBody compact />
    </div>
  );
}

Object.assign(window, { ImportSources, SourcesPanel, ImportBody });

export { ImportSources, SourcesPanel, ImportBody };
