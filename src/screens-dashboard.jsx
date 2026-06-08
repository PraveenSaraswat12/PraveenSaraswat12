import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   LUMEN — Insights Dashboard (business + personal)
   ============================================================ */
const DASH_RANGE = {
  '7d':  { n:4,  f:0.9,  dl:0.5, lab:'vs last week' },
  '30d': { n:12, f:1,    dl:1,   lab:'vs last month' },
  'qtr': { n:12, f:1.12, dl:1.5, lab:'vs last quarter' },
};
function applyRange(data, range) {
  const R = DASH_RANGE[range] || DASH_RANGE['30d'];
  const num = (s) => { const m = String(s).match(/-?\d+\.?\d*/); return m ? parseFloat(m[0]) : null; };
  const fmtLike = (s, v) => {
    const hasPlus = String(s).trim().startsWith('+');
    const dec = (String(s).split('.')[1] || '').length;
    const body = dec ? Math.abs(v).toFixed(dec) : String(Math.round(Math.abs(v)));
    return (v < 0 ? '-' : hasPlus ? '+' : '') + body;
  };
  const metrics = data.metrics.map(m => {
    const v0 = num(m.value);
    return {
      ...m,
      value: v0 == null ? m.value : fmtLike(m.value, v0 * R.f),
      spark: m.spark.slice(Math.max(0, m.spark.length - R.n)).map(x => +(x * R.f).toFixed(3)),
      delta: +(m.delta * R.dl).toFixed(Math.abs(m.delta) % 1 ? 2 : 0),
      deltaLabel: R.lab,
    };
  });
  const sentimentTrend = data.sentimentTrend.slice(data.sentimentTrend.length - R.n).map((p, i) => ({ x:i, y:+(p.y * R.f).toFixed(3) }));
  const recent = range === '7d' ? data.recent.slice(0, 3) : data.recent;
  return { ...data, metrics, sentimentTrend, recent, _range:range };
}

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
  const { data, mode, t, go, flow } = useApp();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const ranges = [['7d','7 days'],['30d','30 days'],['qtr','Quarter']];
  return (
    <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-end', gap:16, marginBottom:22, flexWrap:'wrap' }}>
      <div className="stack" style={{ gap:6 }}>
        <span className="eyebrow">{data.org}</span>
        <h1 className="display" style={{ fontSize:30, margin:0, whiteSpace:'nowrap' }}>
          {greet}, Dana
        </h1>
        {flow.goals?.length > 0 && (
          <div className="row wrap" style={{ gap:7, marginTop:4 }}>
            <span className="faint" style={{ fontSize:12.5 }}>Focused on:</span>
            {flow.goals.slice(0,3).map((g,i)=><span key={i} className="tag">{g}</span>)}
          </div>
        )}
      </div>
      <div className="row" style={{ gap:10 }}>
        <div className="seg" role="tablist" aria-label="Date range">
          {ranges.map(([v,label])=>(
            <button key={v} className={flow.dashRange===v?'on':''} onClick={()=>flow.setDashRange(v)} role="tab" aria-selected={flow.dashRange===v} title={label}>
              {v==='qtr'?'Qtr':v}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={()=>go('analyze')}><Icon name="plus" size={17} />Add recording</button>
      </div>
    </div>
  );
}

/* ============ BUSINESS ============ */
function DashBusiness({ data }) {
  const { go } = useApp();
  return (
    <>
      <div className="grid g-4" key={data._range} style={{ marginBottom:'var(--gap)' }}>
        {data.metrics.map((m,i)=><div key={m.id} style={{ animationDelay:`${i*0.05}s` }}><MetricCard m={m} accent="var(--accent)" /></div>)}
      </div>

      <div className="dash-grid">
        {/* left column */}
        <div className="stack" style={{ gap:'var(--gap)', minWidth:0 }}>
          <Panel title="Patterns that win deals" sub="Ranked by lift across analyzed calls"
            action={<button className="btn btn-soft btn-sm" onClick={()=>go('patterns')}>See all<Icon name="chevR" size={15} /></button>}>
            <div className="stack" style={{ gap:10 }}>
              {data.winPatterns.map((p,i)=>(
                <div key={i} className="winrow card-hover" style={{ display:'flex', gap:14, alignItems:'center', padding:'13px 14px', borderRadius:'var(--r-ctrl)', background:'var(--surface-2)', border:'1px solid var(--line)' }}>
                  <span className="center" style={{ width:38, height:38, borderRadius:11, background:'var(--good-soft)', color:'var(--good)', flex:'none' }}><Icon name="trend" size={19} /></span>
                  <div className="stack grow" style={{ gap:3, minWidth:0 }}>
                    <span style={{ fontWeight:650, fontSize:14.5 }}>{p.t}</span>
                    <span className="muted" style={{ fontSize:12.5, lineHeight:1.4 }}>{p.detail}</span>
                  </div>
                  <div className="stack" style={{ alignItems:'flex-end', gap:3, flex:'none' }}>
                    <span className="badge badge-good">{p.lift}</span>
                    <span className="faint" style={{ fontSize:11 }}>{p.n} calls</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Recommended next actions" sub="One move per prospect, prioritized"
            action={<Badge kind="accent" dot>{data.nextActions.length} active</Badge>}>
            <div className="stack" style={{ gap:0 }}>
              {data.nextActions.map((a,i)=>(
                <div key={i} className="lrow click" onClick={()=>go('conversation')}>
                  <Avatar label={a.avatar} color={a.color} size={38} />
                  <div className="stack grow" style={{ gap:3, minWidth:0 }}>
                    <div className="row" style={{ gap:8 }}>
                      <span className="ttl">{a.who}</span>
                      <span className="tag" style={{ height:21, fontSize:11 }}>{a.stage}</span>
                    </div>
                    <span className="muted" style={{ fontSize:12.5, lineHeight:1.4 }}>{a.action}</span>
                  </div>
                  <div className="stack" style={{ alignItems:'flex-end', gap:4, flex:'none' }}>
                    <span className="metric-num" style={{ fontSize:15 }}>{a.val}</span>
                    <RiskTag risk={a.risk} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* right column */}
        <div className="stack" style={{ gap:'var(--gap)', minWidth:0 }}>
          <Panel title="Sentiment trajectory" sub="Across all calls, last 12 weeks">
            <div style={{ marginTop:4 }} key={data._range}>
              <LineChart series={[{ color:'var(--accent)', data:data.sentimentTrend }]} height={150} yMin={0} yMax={0.55} labels={['','','','','','Now']} />
            </div>
            <div className="row" style={{ justifyContent:'space-between', marginTop:10 }}>
              <span className="faint" style={{ fontSize:12 }}>12 weeks ago</span>
              <Badge kind="good" dot>Trending positive</Badge>
            </div>
          </Panel>

          <Panel title="Top objections" sub="What's blocking deals">
            <HBars items={data.objections.slice(0,4)} showTrend accent="var(--viz-3)" />
            <button className="btn btn-soft btn-sm" style={{ marginTop:14, width:'100%' }} onClick={()=>go('ask')}>
              <Icon name="chat" size={15} />Ask how to handle these
            </button>
          </Panel>

          <Panel title="Recent calls" pad={false} style={{ overflow:'hidden' }}>
            <div style={{ padding:'0 var(--pad-card)' }}><div className="sec-title" style={{ paddingTop:'var(--pad-card)' }}><div className="stack" style={{ gap:2 }}><h3>Recent calls</h3></div><button className="btn btn-soft btn-sm" onClick={()=>go('sources')}>All</button></div></div>
            <div style={{ padding:'0 var(--pad-card) 6px' }}>
              {data.recent.slice(0,4).map((c,i)=><RecentRow key={c.id} c={c} onClick={()=>go('conversation',{convo:c.id, from:'dashboard', rec:c})} />)}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function RiskTag({ risk }) {
  const map = { hot:{k:'bad',l:'Act now'}, warm:{k:'warn',l:'This week'}, cool:{k:'neutral',l:'Nurture'} };
  const m = map[risk] || map.cool;
  return <span className={`badge badge-${m.k}`}>{m.l}</span>;
}

function RecentRow({ c, onClick }) {
  return (
    <div className="lrow click" onClick={onClick}>
      <div style={{ width:54, height:30, flex:'none' }}><Waveform bars={16} seed={c.id.charCodeAt(1)||3} height={28} gap={2} color="var(--line-2)" /></div>
      <div className="stack grow" style={{ gap:2, minWidth:0 }}>
        <span className="ttl" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</span>
        <span className="meta">{c.dur} · {c.when}</span>
      </div>
      {c.status==='analyzed' ? <SentDot s={c.sent} /> : <StatusPill status={c.status} />}
    </div>
  );
}

/* ============ PERSONAL ============ */
function DashPersonal({ data }) {
  const { go } = useApp();
  return (
    <>
      <div className="grid g-4" key={data._range} style={{ marginBottom:'var(--gap)' }}>
        {data.metrics.map((m,i)=><div key={m.id} style={{ animationDelay:`${i*0.05}s` }}><MetricCard m={m} accent="var(--accent)" /></div>)}
      </div>

      <div className="dash-grid">
        <div className="stack" style={{ gap:'var(--gap)', minWidth:0 }}>
          <Panel title="Behavior patterns" sub="Gentle observations, never judgments"
            action={<button className="btn btn-soft btn-sm" onClick={()=>go('patterns')}>See all<Icon name="chevR" size={15} /></button>}>
            <div className="stack" style={{ gap:10 }}>
              {data.behaviors.map((b,i)=>{
                const tone = { good:['var(--good-soft)','var(--good)','heart'], warn:['var(--warn-soft)','var(--warn)','flame'], neutral:['var(--surface-sunken)','var(--ink-2)','quote'] }[b.tone];
                return (
                  <div key={i} className="card-hover" style={{ display:'flex', gap:14, alignItems:'flex-start', padding:'14px', borderRadius:'var(--r-ctrl)', background:'var(--surface-2)', border:'1px solid var(--line)' }}>
                    <span className="center" style={{ width:38, height:38, borderRadius:11, background:tone[0], color:tone[1], flex:'none' }}><Icon name={tone[2]} size={19} /></span>
                    <div className="stack grow" style={{ gap:4, minWidth:0 }}>
                      <span style={{ fontWeight:650, fontSize:14.5 }}>{b.t}</span>
                      <span className="muted" style={{ fontSize:12.5, lineHeight:1.45 }}>{b.detail}</span>
                      {b.source && <span className="row" style={{ gap:6, color:'var(--ink-3)', fontSize:11.5, fontWeight:500 }}><Icon name="leaf" size={12} />{b.source}</span>}
                    </div>
                    <span className="tag" style={{ flex:'none' }}>{b.n}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Recurring themes" sub="What you talk about, and how it feels">
            <div className="grid g-2" style={{ gap:12 }}>
              {data.themes.map((th,i)=>{
                const mood = { pos:['var(--good)','Warm'], neg:['var(--viz-4)','Tense'], neu:['var(--ink-3)','Calm'] }[th.mood];
                return (
                  <div key={i} style={{ padding:14, borderRadius:'var(--r-ctrl)', background:'var(--surface-2)', border:'1px solid var(--line)' }}>
                    <div className="row" style={{ justifyContent:'space-between' }}>
                      <span style={{ fontWeight:650, fontSize:14 }}>{th.t}</span>
                      <span className="metric-num" style={{ fontSize:16 }}>{th.share}%</span>
                    </div>
                    <div className="bar" style={{ height:7, margin:'10px 0' }}><i style={{ width:`${th.share}%`, background:mood[0] }} /></div>
                    <span className="faint" style={{ fontSize:12, lineHeight:1.4 }}>{th.sample}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="stack" style={{ gap:'var(--gap)', minWidth:0 }}>
          <Panel title="Small steps to try" sub="Tiny, kind experiments"
            action={<span className="center" style={{ width:32, height:32, borderRadius:9, background:'var(--accent-soft)', color:'var(--accent-strong)' }}><Icon name="target" size={17} /></span>}>
            <div className="stack" style={{ gap:10 }}>
              {data.steps.map((s,i)=>(
                <label key={i} className="row click" style={{ gap:11, alignItems:'flex-start', padding:'11px 12px', borderRadius:'var(--r-ctrl)', background:'var(--surface-2)', border:'1px solid var(--line)' }}>
                  <span className="center" style={{ width:22, height:22, borderRadius:7, flex:'none', marginTop:1, background:s.done?'var(--accent)':'transparent', border:s.done?'0':'1.5px solid var(--line-2)', color:'#fff' }}>{s.done && <Icon name="check" size={13} stroke={3} />}</span>
                  <div className="stack" style={{ gap:5 }}>
                    <span style={{ fontWeight:600, fontSize:13.5, textDecoration:s.done?'line-through':'none', opacity:s.done?0.6:1 }}>{s.t}</span>
                    <span className="faint" style={{ fontSize:12, lineHeight:1.4 }}>{s.detail}</span>
                    {s.source && <span className="row" style={{ gap:6, marginTop:1 }}><span className="tag" style={{ height:22, fontSize:11 }}><Icon name="book" size={12} />{s.source.title}</span></span>}
                  </div>
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="Emotional tone" sub="Last 12 weeks">
            <LineChart series={[{ color:'var(--accent)', data:data.sentimentTrend }]} height={130} yMin={0} yMax={0.45} labels={['','','','','','Now']} />
            <div style={{ marginTop:16 }}>
              <div className="row" style={{ justifyContent:'space-between', marginBottom:8 }}><span className="faint" style={{ fontSize:12 }}>Daily mood</span><Legend items={[{name:'Calm',color:'var(--good)'},{name:'Mixed',color:'var(--viz-3)'},{name:'Tense',color:'var(--viz-4)'}]} /></div>
              <MoodStrip weeks={12} seed={4} />
            </div>
          </Panel>

          <Panel title="Recent reflections" pad={false}>
            <div style={{ padding:'var(--pad-card) var(--pad-card) 6px' }}>
              <div className="sec-title"><div className="stack" style={{ gap:2 }}><h3>Recent reflections</h3></div></div>
              {data.recent.slice(0,4).map((c)=><RecentRow key={c.id} c={c} onClick={()=>go('conversation',{convo:c.id, from:'dashboard', rec:c})} />)}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Dashboard() {
  const { mode, data, flow, wiped, go } = useApp();
  if (wiped) {
    return (
      <div className="page">
        <GreetHeader />
        <div className="card card-pad center" style={{ minHeight:'46vh' }}>
          <div className="stack center" style={{ gap:14, maxWidth:380, textAlign:'center' }}>
            <span className="center" style={{ width:56, height:56, borderRadius:17, background:'var(--surface-sunken)', color:'var(--ink-3)' }}><Icon name="grid" size={26} /></span>
            <span style={{ fontWeight:700, fontSize:17 }}>No insights yet</span>
            <span className="muted" style={{ fontSize:13.5, lineHeight:1.55 }}>Your recordings were deleted, so there’s nothing to analyze. Add a new recording and Kithra will rebuild your insights.</span>
            <button className="btn btn-primary" onClick={()=>go('analyze')}><Icon name="plus" size={16} />Add a recording</button>
          </div>
        </div>
      </div>
    );
  }
  const rd = applyRange(data, flow.dashRange);
  return (
    <div className="page">
      <GreetHeader />
      {mode === 'business' ? <DashBusiness data={rd} /> : <DashPersonal data={rd} />}
    </div>
  );
}

Object.assign(window, { Dashboard, MetricCard, Panel, RecentRow, GreetHeader });


export { Dashboard, MetricCard, Panel, RecentRow, GreetHeader };
