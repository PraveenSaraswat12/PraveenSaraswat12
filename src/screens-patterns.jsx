import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import { Panel } from './screens-dashboard.jsx';
/* ============================================================
   LUMEN — Patterns & Trends over time (working filters + grounding)
   ============================================================ */
const FACTOR = {
  all:1, everyone:1, self:1,
  upload:1.03, meet:0.9, drive:0.86, zoom:1.12, teams:0.95, voice:1.06, calls:0.92,
  dana:1.08, sam:0.9, family:0.88, work:1.14,
  discovery:0.85, proposal:1.16, negotiation:1.06,
  reflection:0.98, relationships:0.9, rest:0.8,
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function hashStr(s){ let h=7; for(let i=0;i<s.length;i++) h=(h*31 + s.charCodeAt(i))%9973; return h; }

function patternOpts(mode){
  return {
    range:[{value:'4w',label:'Last 4 weeks'},{value:'12w',label:'Last 12 weeks'},{value:'qtr',label:'This quarter'},{value:'12m',label:'Last 12 months'}],
    source: mode==='business'
      ? [{value:'all',label:'All sources'},{value:'upload',label:'Audio uploads',icon:'wave'},{value:'meet',label:'Google Meet',icon:'google'},{value:'drive',label:'Google Drive',icon:'drive'},{value:'zoom',label:'Zoom',icon:'zoom'},{value:'teams',label:'Microsoft Teams',icon:'teams'}]
      : [{value:'all',label:'All sources'},{value:'voice',label:'Voice memos',icon:'mic'},{value:'calls',label:'Recorded calls',icon:'wave'},{value:'drive',label:'Google Drive',icon:'drive'}],
    person: mode==='business'
      ? [{value:'all',label:'All reps'},{value:'dana',label:'Dana R.'},{value:'sam',label:'Sam K.'}]
      : [{value:'everyone',label:'Everyone'},{value:'family',label:'Family'},{value:'work',label:'Colleagues'},{value:'self',label:'Just me'}],
    tag: mode==='business'
      ? [{value:'all',label:'All tags'},{value:'discovery',label:'Discovery'},{value:'proposal',label:'Proposal'},{value:'negotiation',label:'Negotiation'}]
      : [{value:'all',label:'All tags'},{value:'reflection',label:'Reflection'},{value:'relationships',label:'Relationships'},{value:'rest',label:'Health & rest'}],
  };
}

function markerRow(range, gran){
  const monthly = gran==='monthly' || range==='12m';
  if (monthly) return ['Jul','Sep','Nov','Jan','Mar','May','Now'];
  if (range==='4w') return ['4w','3w','2w','1w','Now'];
  return ['12w','10w','8w','6w','4w','2w','Now'];
}

function Patterns() {
  const { data, mode, showToast, wiped, go, planAllows } = useApp();
  const isBiz = mode === 'business';
  if (!planAllows('plus')) {
    return (
      <div className="page">
        <div className="stack" style={{ gap:6, marginBottom:18 }}><span className="eyebrow">Over time</span><h1 className="display" style={{ fontSize:28, margin:0, whiteSpace:'nowrap' }}>Patterns &amp; trends</h1></div>
        <div className="card card-pad center" style={{ minHeight:'46vh' }}>
          <div className="stack center" style={{ gap:14, maxWidth:400, textAlign:'center' }}>
            <span className="center" style={{ width:58, height:58, borderRadius:17, background:'color-mix(in srgb,var(--viz-5) 15%,transparent)', color:'var(--viz-5)' }}><Icon name="trend" size={27} /></span>
            <span className="lock-pill" data-tier="plus" style={{ height:22 }}><Icon name="lock" size={10} />Plus feature</span>
            <span style={{ fontWeight:700, fontSize:17 }}>Patterns &amp; trends are on Plus</span>
            <span className="muted" style={{ fontSize:13.5, lineHeight:1.55 }}>Your dashboard stays free. Upgrade to Plus to see how your conversations trend over time — sentiment trajectory, recurring topics, and behavior frequency across all your recordings.</span>
            <button className="btn btn-primary" onClick={()=>go('pricing')}><Icon name="spark" size={16} />Upgrade to Plus</button>
          </div>
        </div>
      </div>
    );
  }
  if (wiped) {
    return (
      <div className="page">
        <div className="stack" style={{ gap:6, marginBottom:18 }}><span className="eyebrow">Over time</span><h1 className="display" style={{ fontSize:28, margin:0, whiteSpace:'nowrap' }}>Patterns &amp; trends</h1></div>
        <div className="card card-pad center" style={{ minHeight:'40vh' }}>
          <div className="stack center" style={{ gap:14, maxWidth:360, textAlign:'center' }}>
            <span className="center" style={{ width:56, height:56, borderRadius:17, background:'var(--surface-sunken)', color:'var(--ink-3)' }}><Icon name="trend" size={26} /></span>
            <span style={{ fontWeight:700, fontSize:16 }}>No trends to show</span>
            <span className="muted" style={{ fontSize:13.5, lineHeight:1.5 }}>Patterns build from your recordings — and yours were deleted. Capture again to see trends over time.</span>
            <button className="btn btn-primary btn-sm" onClick={()=>go('analyze')}><Icon name="plus" size={14} />Add a recording</button>
          </div>
        </div>
      </div>
    );
  }
  const opts = React.useMemo(()=>patternOpts(mode), [mode]);
  const [range, setRange] = React.useState('12w');
  const [source, setSource] = React.useState('all');
  const [person, setPerson] = React.useState(isBiz ? 'all' : 'everyone');
  const [tag, setTag] = React.useState('all');
  const [gran, setGran] = React.useState('weekly');
  React.useEffect(()=>{ setPerson(isBiz?'all':'everyone'); setSource('all'); setTag('all'); }, [mode]);

  const factor = clamp((FACTOR[source]||1)*(FACTOR[person]||1)*(FACTOR[tag]||1), 0.6, 1.55);
  const monthly = gran==='monthly' || range==='12m';
  const n = range==='4w' ? 4 : 12;
  const sig = `${range}|${source}|${person}|${tag}|${gran}`;
  const markers = markerRow(range, gran);
  const blankLabels = markers.map(()=>''); // keep x-axis clean; markers rendered separately

  // transform a series array {x,y}
  const view = React.useCallback((arr)=>{
    const sliced = arr.slice(arr.length - n);
    return sliced.map((p,i)=>({ x:i, y:+(p.y*factor).toFixed(3) }));
  }, [n, factor]);

  const topics = data.topicsTrend.map(s=>({ ...s, data:view(s.data) }));
  const sentiment = view(data.sentimentTrend);

  // reweight share-based items so the mix visibly responds to filters
  const reweight = React.useCallback((items)=>{
    const h = hashStr(sig);
    const raw = items.map((it,i)=>({ ...it, w: Math.max(0.5, it.share*(1 + 0.28*Math.sin(h*0.7 + i*1.7))) }));
    const tot = raw.reduce((a,b)=>a+b.w,0) || 1;
    return raw.map(it=>({ ...it, share: Math.max(3, Math.round(it.w/tot*100)) }));
  }, [sig]);
  // sort by share so the donut centre (mixItems[0]) and legend agree on the true top item
  const mixItems = reweight((isBiz?data.objections:data.themes).slice(0,5)).sort((a,b)=>b.share-a.share);

  // tangible "matches" count
  const base = isBiz ? 1000 : 24;
  const matches = Math.max(3, Math.round(base
    * (range==='4w'?0.32:range==='12w'?1:range==='qtr'?1:1)
    * (source!=='all'?0.42:1)
    * ((person!=='all'&&person!=='everyone')?0.5:1)
    * (tag!=='all'?0.46:1)));

  const anyFilter = source!=='all' || (person!=='all'&&person!=='everyone') || tag!=='all' || range!=='12w' || gran!=='weekly';
  const reset = ()=>{ setRange('12w'); setSource('all'); setPerson(isBiz?'all':'everyone'); setTag('all'); setGran('weekly'); };

  return (
    <div className="page">
      <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-end', marginBottom:18, flexWrap:'wrap', gap:14 }}>
        <div className="stack" style={{ gap:6 }}>
          <span className="eyebrow">Over time</span>
          <h1 className="display" style={{ fontSize:28, margin:0, whiteSpace:'nowrap' }}>Patterns & trends</h1>
        </div>
        <button className="btn btn-soft" onClick={()=>showToast('Exporting patterns as PDF…', 'download')}><Icon name="download" size={16} />Export</button>
      </div>

      {/* working filters */}
      <div className="pt-filters">
        <Dropdown icon="calendar" label="Range" value={range} options={opts.range} onChange={setRange} />
        <Dropdown icon="layers" label="Source" value={source} options={opts.source} onChange={setSource} />
        <Dropdown icon="user" label={isBiz?'Rep':'With'} value={person} options={opts.person} onChange={setPerson} />
        <Dropdown icon="filter" label="Tag" value={tag} options={opts.tag} onChange={setTag} />
        <div className="grow" />
        <div className="seg">
          <button className={gran==='weekly'?'on':''} onClick={()=>setGran('weekly')}>Weekly</button>
          <button className={gran==='monthly'?'on':''} onClick={()=>setGran('monthly')}>Monthly</button>
        </div>
      </div>

      {/* active-filter summary */}
      <div className="row" style={{ gap:10, marginBottom:'var(--gap)', flexWrap:'wrap' }}>
        <span className="badge badge-accent" style={{ height:26 }}><Icon name="wave" size={13} /><span className="tnum">{matches.toLocaleString()}</span> {isBiz?'calls':'recordings'} match</span>
        <span className="faint" style={{ fontSize:12.5 }}>{markers[0]} → now · {gran}</span>
        {anyFilter && <button className="chip" style={{ height:26, fontSize:12 }} onClick={reset}><Icon name="x" size={13} />Clear filters</button>}
      </div>

      {/* hero trend */}
      <Panel title={isBiz?'What your buyers are talking about':'What you keep returning to'}
        sub="Topic frequency across the selected recordings"
        action={<Legend items={topics.map(s=>({name:s.name,color:s.color}))} />}
        style={{ marginBottom:'var(--gap)' }}>
        <div key={sig}>
          <LineChart series={topics} height={250} area={false} labels={blankLabels} strokeW={2.6} />
          <div className="row" style={{ justifyContent:'space-between', marginTop:6 }}>
            {markers.map((w,i)=><span key={i} className="faint tnum" style={{ fontSize:11 }}>{w}</span>)}
          </div>
        </div>
      </Panel>

      <div className="grid g-2" style={{ marginBottom:'var(--gap)' }}>
        <Panel title={isBiz?'Sentiment trajectory':'Emotional tone'} sub="Direction over the selected window">
          <div key={sig+'s'}>
            <LineChart series={[{ color:'var(--accent)', data:sentiment }]} height={180} yMin={0} labels={blankLabels} />
          </div>
          <div className="row" style={{ justifyContent:'space-between', marginTop:12 }}>
            <Stat label="Trend" value={factor>=1?'Rising':'Easing'} tone={factor>=1?'good':'neutral'} />
            <Stat label="Volatility" value={isBiz?'Low':'Moderate'} tone="neutral" />
            <Stat label="Best window" value={isBiz?'Tue AM':'Mornings'} tone="neutral" />
          </div>
        </Panel>

        <Panel title={isBiz?'Objection mix':'Theme distribution'} sub={isBiz?'Share of objections raised':'Where your time & energy goes'}>
          <div className="row" style={{ gap:24, alignItems:'center', flexWrap:'wrap' }} key={sig+'d'}>
            <Donut size={150} thickness={20}
              segments={mixItems.map((o,i)=>({ value:o.share, color:`var(--viz-${i+1})` }))}
              centerTop="Top" centerBig={`${mixItems[0].share}%`} centerSub={mixItems[0].t.split(' ')[0]} />
            <div className="stack grow" style={{ gap:11, minWidth:150 }}>
              {mixItems.map((o,i)=>(
                <div key={i} className="row" style={{ justifyContent:'space-between', gap:10 }}>
                  <span className="row" style={{ gap:9 }}><i className="dot" style={{ width:10, height:10, background:`var(--viz-${i+1})` }} /><span style={{ fontSize:13, fontWeight:500 }}>{o.t}</span></span>
                  <span className="tnum" style={{ fontSize:13, fontWeight:700 }}>{o.share}%</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* frequency / heat */}
      <Panel title={isBiz?'Winning behaviors, by frequency':'Behavior frequency'} sub={isBiz?'How often each pattern shows up in won deals':'How often each shows up across your recordings'} style={{ marginBottom:'var(--gap)' }}>
        <div className="grid g-2" style={{ gap:'var(--gap)' }} key={sig+'f'}>
          <HBars items={(isBiz?data.winPatterns.map(p=>({t:p.t,share:clamp(Math.round((parseInt(p.lift)+50)*factor),20,99),color:'var(--good)'})):data.behaviors.map((b,i)=>({t:b.t,share:clamp(Math.round([78,64,86,52][i]*factor),20,99),color:`var(--viz-${i+1})`})))} />
          <div className="stack" style={{ gap:14 }}>
            <span className="eyebrow">{isBiz?'Call volume — selected window':'Reflection consistency'}</span>
            <MoodStrip weeks={n} seed={hashStr(sig)%9} />
            <div className="row wrap" style={{ gap:16, marginTop:4 }}>
              <Stat label={isBiz?'Calls in view':'Recordings'} value={matches.toLocaleString()} tone="neutral" />
              <Stat label={isBiz?'Avg / week':'Streak'} value={isBiz?Math.round(matches/12).toString():'12 days'} tone="good" />
              <Stat label="Trend" value={factor>=1?'Up':'Steady'} tone={factor>=1?'good':'neutral'} />
            </div>
          </div>
        </div>
      </Panel>

      {/* grounding / evidence base */}
      <GroundingPanel data={data} isBiz={isBiz} />
    </div>
  );
}

function GroundingPanel({ data, isBiz }) {
  return (
    <Panel title={isBiz?'Methodologies Kithra draws on':'How Kithra forms its reflections'}
      sub="Every insight is benchmarked against established, published sources">
      <div className="grid g-2" style={{ gap:'var(--gap)', alignItems:'start' }}>
        <EvidenceList items={data.evidence} label={isBiz?'Benchmarked against':'Grounded in'} />
        <div className="stack" style={{ gap:0 }}>
          <p className="muted" style={{ margin:0, fontSize:14, lineHeight:1.6 }}>{data.evidenceNote}</p>
          {!isBiz && (
            <div className="disclaimer">
              <span className="center" style={{ width:34, height:34, borderRadius:10, background:'var(--good-soft)', color:'var(--good)', flex:'none' }}><Icon name="heart" size={17} /></span>
              <div className="stack" style={{ gap:2 }}>
                <span style={{ fontWeight:650, fontSize:13.5 }}>Supportive, not clinical</span>
                <span className="faint" style={{ fontSize:12.5, lineHeight:1.5 }}>Kithra offers gentle, evidence-informed reflection — not a diagnosis or therapy. For ongoing distress, please reach out to a licensed professional.</span>
              </div>
            </div>
          )}
          {isBiz && (
            <div className="disclaimer">
              <span className="center" style={{ width:34, height:34, borderRadius:10, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name="target" size={17} /></span>
              <div className="stack" style={{ gap:2 }}>
                <span style={{ fontWeight:650, fontSize:13.5 }}>Tuned to your team</span>
                <span className="faint" style={{ fontSize:12.5, lineHeight:1.5 }}>Recommendations blend proven methodology with the patterns actually found in your own calls — so advice fits how your team really sells.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value, tone }) {
  const c = tone==='good'?'var(--good)':tone==='bad'?'var(--bad)':'var(--ink)';
  return (
    <div className="stack" style={{ gap:3 }}>
      <span className="faint" style={{ fontSize:11.5, fontWeight:600 }}>{label}</span>
      <span style={{ fontSize:16, fontWeight:700, color:c }}>{value}</span>
    </div>
  );
}

Object.assign(window, { Patterns });


export { Patterns };
