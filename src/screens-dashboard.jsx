import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   KITHRA — Dashboard: real metrics from YOUR recordings + a Gemini brief
   ============================================================ */

function MetricCard({ m, accent }) {
  return (
    <div className="card card-pad card-hover metric anim-up">
      <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start' }}>
        <span className="label">{m.label}</span>
      </div>
      <div className="val">
        <span className="metric-num n">{m.value}</span>
        {m.unit && <span className="u">{m.unit}</span>}
      </div>
      <div className="row" style={{ justifyContent:'space-between', marginTop:14, gap:8 }}>
        <span className="row" style={{ gap:7 }}>
          <Delta value={m.delta} invert={m.good===false} />
          <span className="faint" style={{ fontSize:12 }}>{m.deltaLabel}</span>
        </span>
        <Sparkline data={m.spark} color={accent} width={86} height={32} />
      </div>
    </div>
  );
}

function Panel({ title, sub, action, children, style, pad = true }) {
  return (
    <section className={`card ${pad?'card-pad':''} anim-up`} style={style}>
      <div className="sec-title">
        <div className="stack" style={{ gap:2 }}>
          <h3>{title}</h3>
          {sub && <span className="sub">{sub}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function GreetHeader() {
  const { go, user, openCapture } = useApp();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = user && user.email ? user.email.split('@')[0] : 'there';
  return (
    <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-end', marginBottom:'var(--gap)', flexWrap:'wrap', gap:14 }}>
      <div className="stack" style={{ gap:6 }}>
        <span className="eyebrow">Where talk becomes insight</span>
        <h1 className="display" style={{ fontSize:'clamp(22px,3vw,30px)', margin:0 }}>{greet}, {name}</h1>
      </div>
      <div className="row" style={{ gap:8, flexWrap:'wrap' }}>
        <button className="btn btn-primary" onClick={()=>openCapture('listen')}><Icon name="mic" size={16} />Go live</button>
        <button className="btn btn-soft" onClick={()=>go('analyze')}><Icon name="plus" size={16} />Add recording</button>
      </div>
    </div>
  );
}

function RecentRow({ c, onClick }) {
  const a = c.analysis || {};
  const fmtDur = (s)=>`${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,'0')}`;
  return (
    <button className="recent-row click" onClick={onClick} style={{ width:'100%', textAlign:'left', border:0, background:'transparent', display:'flex', gap:12, alignItems:'center', padding:'12px 4px', borderBottom:'1px solid var(--line)' }}>
      <span className="center" style={{ width:36, height:36, borderRadius:11, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name="wave" size={17} /></span>
      <span className="stack grow" style={{ gap:2, minWidth:0 }}>
        <span style={{ fontWeight:650, fontSize:13.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name||'Recording'}</span>
        <span className="faint" style={{ fontSize:12 }}>{fmtDur(c.durSec)}{a.wpm!=null?` · ${a.wpm} wpm`:''}{c.transcript?' · transcribed':''}</span>
      </span>
      <Icon name="chevR" size={16} style={{ color:'var(--ink-3)', flex:'none' }} />
    </button>
  );
}

/* ---------- REAL dashboard: everything computed from your recordings ---------- */
function Dashboard() {
  const { go, mode, clips, books, user, hasConsent } = useApp();
  const has = (clips||[]).length > 0;
  const a = (c) => c.analysis || {};
  const avg = (arr) => arr.length ? arr.reduce((x,y)=>x+y,0)/arr.length : 0;
  const wpmList = (clips||[]).map(c=>a(c).wpm).filter(v=>v!=null);
  const voiceList = (clips||[]).map(c=>a(c).talkRatio).filter(v=>v!=null);
  const pausesTotal = (clips||[]).reduce((x,c)=>x+(a(c).pauses||0),0);
  const totalMin = Math.round((clips||[]).reduce((x,c)=>x+(c.durSec||0),0)/60);
  const transcribed = (clips||[]).filter(c=>c.transcript).length;
  const ordered = [...(clips||[])].sort((x,y)=>(x.ts||0)-(y.ts||0));
  const series = (f)=> ordered.map(c=>f(a(c))).filter(v=>v!=null);
  const wpmSeries = series(x=>x.wpm);
  const voiceSeries = series(x=>x.talkRatio!=null?Math.round(x.talkRatio*100):null);

  // AI brief — a real Gemini read across your library (consented)
  const [brief, setBrief] = React.useState('');
  const [briefState, setBriefState] = React.useState('idle');
  const runBrief = async () => {
    setBriefState('run');
    try {
      const out = await window.KithraAI.askKithra({
        question: mode==='business'
          ? 'Give me a sharp 3-sentence brief on my recent conversations: how I am performing, the clearest pattern, and the one thing to do next.'
          : 'Give me a gentle 3-sentence reflection on my recent recordings: how I sound, one pattern you notice, and one small thing to try.',
        mode, clips, books });
      setBrief(out); setBriefState('done');
    } catch(e){ setBrief('Couldn’t reach the AI just now — try again in a moment.'); setBriefState('done'); }
  };

  return (
    <div className="page">
      <GreetHeader />

      {!has ? (
        <div className="card center anim-up" style={{ padding:'70px 24px' }}>
          <div className="stack center" style={{ gap:16, maxWidth:460, textAlign:'center' }}>
            <span className="center" style={{ width:64, height:64, borderRadius:20, background:'var(--accent-soft)', color:'var(--accent-strong)' }}><Icon name="mic" size={30} /></span>
            <h2 className="display" style={{ fontSize:26, margin:0 }}>Your dashboard is waiting for its first recording</h2>
            <p className="muted" style={{ margin:0, fontSize:14.5, lineHeight:1.6 }}>Record a voice note or upload a call. Kithra measures it on your device — pace, pauses, energy — then this page fills with your real numbers. No sample data here.</p>
            <div className="row center" style={{ gap:10, flexWrap:'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={()=>go('analyze')}><Icon name="mic" size={18} />Record or upload</button>
              <button className="btn btn-soft btn-lg" onClick={()=>go('books')}><Icon name="book" size={17} />Browse the books</button>
            </div>
            <PrivacyChip text="Analyzed on-device · nothing leaves without your consent" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid g-4" style={{ marginBottom:'var(--gap)' }}>
            {[
              { label:'Recordings', value:String((clips||[]).length), unit:'', spark:ordered.map((_,i)=>i+1) },
              { label:'Minutes captured', value:String(totalMin), unit:'min', spark:ordered.map(c=>Math.round((c.durSec||0)/60)) },
              { label:'Avg. pace', value: wpmList.length?String(Math.round(avg(wpmList))):'—', unit:'wpm', spark:wpmSeries },
              { label:'Avg. active voice', value: voiceList.length?String(Math.round(avg(voiceList)*100)):'—', unit:'%', spark:voiceSeries },
            ].map((m,i)=>(
              <div key={i} className="card card-pad metric anim-up" style={{ animationDelay:`${i*0.05}s` }}>
                <span className="label">{m.label}</span>
                <div className="val"><span className="metric-num n">{m.value}</span>{m.unit && <span className="u">{m.unit}</span>}</div>
                {m.spark && m.spark.length>1 && <div style={{ marginTop:12 }}><Sparkline data={m.spark} color="var(--accent)" width={120} height={30} /></div>}
              </div>
            ))}
          </div>

          <div className="grid g-2" style={{ gap:'var(--gap)', marginBottom:'var(--gap)' }}>
            <Panel title="Kithra’s read" sub={`A real Kithra AI brief across your ${(clips||[]).length} recording${(clips||[]).length>1?'s':''}`}
              action={<Badge kind="accent" dot={briefState==='run'}>Kithra AI</Badge>}>
              {briefState==='idle' && (
                <div className="stack" style={{ gap:12 }}>
                  <p className="muted" style={{ margin:0, fontSize:13.5, lineHeight:1.6 }}>Ask Kithra to read across everything you’ve recorded{transcribed<(clips||[]).length?` (${(clips||[]).length-transcribed} not transcribed yet — transcripts make this sharper)`:''} and give you the headline.</p>
                  {window.KithraAI && window.KithraAI.aiReady()
                    ? (hasConsent('cloud_ai')
                        ? <button className="btn btn-primary btn-sm" style={{ alignSelf:'flex-start' }} onClick={runBrief}><Icon name="spark" size={14} fill />Generate my brief</button>
                        : <button className="btn btn-primary btn-sm" style={{ alignSelf:'flex-start' }} onClick={()=>go('privacy')}><Icon name="shield" size={14} />Allow Kithra AI first (Privacy → Consent)</button>)
                    : <span className="faint" style={{ fontSize:12.5 }}>Connect the cloud in Privacy & Data to enable this.</span>}
                </div>
              )}
              {briefState==='run' && <div className="row" style={{ gap:12 }}><LiveWave bars={20} height={30} /><span className="faint" style={{ fontSize:13 }}>Reading your recordings…</span></div>}
              {briefState==='done' && (
                <div className="stack" style={{ gap:12 }}>
                  <p style={{ margin:0, fontSize:14.5, lineHeight:1.65 }}>{brief}</p>
                  <button className="btn btn-soft btn-sm" style={{ alignSelf:'flex-start' }} onClick={runBrief}><Icon name="refresh" size={14} />Refresh</button>
                </div>
              )}
            </Panel>

            <Panel title="Recent recordings" pad={false} style={{ overflow:'hidden' }}
              action={<button className="btn btn-soft btn-sm" onClick={()=>go('library')}>All<Icon name="chevR" size={14} /></button>}>
              <div style={{ padding:'4px var(--pad-card) 8px' }}>
                {[...(clips||[])].slice(0,5).map(c=><RecentRow key={c.id} c={c} onClick={()=>go('conversation',{convo:c.id, from:'dashboard', rec:c})} />)}
              </div>
            </Panel>
          </div>

          <div className="grid g-2" style={{ gap:'var(--gap)' }}>
            <Panel title="Pace over time" sub="Words per minute, every recording (measured on-device)">
              {wpmSeries.length>1
                ? <LineChart series={[{ color:'var(--accent)', data:wpmSeries.map((y,x)=>({x,y})) }]} height={170} yMin={0} labels={wpmSeries.map(()=> '')} />
                : <p className="faint" style={{ fontSize:13 }}>Add one more recording to see your trend.</p>}
            </Panel>
            <Panel title="Talk vs. listen" sub="Active-voice share per recording">
              {voiceSeries.length>1
                ? <LineChart series={[{ color:'var(--viz-2)', data:voiceSeries.map((y,x)=>({x,y})) }]} height={170} yMin={0} yMax={100} labels={voiceSeries.map(()=> '')} />
                : <p className="faint" style={{ fontSize:13 }}>Add one more recording to see your balance.</p>}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

Object.assign(window, { Dashboard, MetricCard, Panel, RecentRow, GreetHeader });


export { Dashboard, MetricCard, Panel, RecentRow, GreetHeader };
