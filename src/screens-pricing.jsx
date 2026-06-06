import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   SONARI — Plans & pricing (3 tiers; capture free, insights paid)
   ============================================================ */
function Pricing() {
  const { mode, go, setTweak, t, plan, setPlan, showToast } = useApp();
  const isBiz = mode === 'business';
  const [annual, setAnnual] = React.useState(true);

  const plans = [
    {
      id:'free', name:'Free', tagline:'Capture everything, forever',
      price:0, accent:'var(--viz-1)',
      cta:'Current plan', ctaStyle:'btn-soft',
      features:[
        ['mic','Live capture on mobile (always-on)'],
        ['refresh','Auto cloud backup every 15 min'],
        ['layers','Recordings library + playback'],
        ['clock','60-day storage · 2 GB'],
        ['calendar','Date & length filters'],
        ['chat','Ask Kithra — 10 questions / month'],
      ],
      note:'Mobile only. No card required.',
    },
    {
      id:'plus', name:'Plus', tagline:'Understand yourself & every talk',
      price: annual?9:12, accent:'var(--accent)', popular: !isBiz,
      cta:'Upgrade to Plus', ctaStyle:'btn-primary',
      features:[
        ['check','Everything in Free, plus:'],
        ['grid','Web & desktop app (capture anywhere)'],
        ['layers','30 GB storage · 180-day retention'],
        ['spark','AI categories, topics & tone filters'],
        ['chat','Unlimited Ask Kithra + voice agent'],
        ['download','Download & bulk-download recordings'],
        ['file','Transcript download'],
      ],
      note:'For individuals going deep.',
    },
    {
      id:'pro', name:'Premium', tagline:'Insights, people & teams',
      price: annual?29:36, unit:'/seat', accent:'var(--viz-5)', popular: isBiz,
      cta:'Go Premium', ctaStyle:'btn-primary',
      features:[
        ['check','Everything in Plus, plus:'],
        ['user','People & relationship filters'],
        ['spark','Insights on any recording — just tap'],
        ['mic','Talk to the agent about any recording'],
        ['layers','Unlimited storage & retention'],
        ['download','PDF export (summary or transcript)'],
        ['shield','SSO, SOC 2 & priority support'],
      ],
      note:'Billed per seat.',
    },
  ];

  return (
    <div className="page">
      <div className="stack center" style={{ gap:10, textAlign:'center', marginBottom:26 }}>
        <span className="eyebrow">Plans</span>
        <h1 className="display" style={{ fontSize:'clamp(26px,3vw,38px)', margin:0 }}>Capture is free. Pay to understand it.</h1>
        <p className="muted" style={{ fontSize:15, margin:0, maxWidth:560, lineHeight:1.55 }}>
          Listening, storage and backup are free for everyone, forever. Upgrade when you want Kithra to turn your recordings into insight.
        </p>
        <div className="seg" style={{ marginTop:6 }}>
          <button className={!annual?'on':''} onClick={()=>setAnnual(false)}>Monthly</button>
          <button className={annual?'on':''} onClick={()=>setAnnual(true)}>Annual · save 25%</button>
        </div>
      </div>

      <div className="grid g-3 price-grid">
        {plans.map(p=>(
          <div key={p.id} className={`card card-pad price-card ${p.popular?'pop':''}`} style={{ '--pc':p.accent }}>
            {p.popular && <span className="price-badge">Recommended</span>}
            <div className="stack" style={{ gap:4 }}>
              <span style={{ fontWeight:700, fontSize:18, color:'var(--pc)' }}>{p.name}</span>
              <span className="faint" style={{ fontSize:13 }}>{p.tagline}</span>
            </div>
            <div className="row" style={{ alignItems:'baseline', gap:4, margin:'18px 0 4px' }}>
              <span className="metric-num" style={{ fontSize:38 }}>${p.price}</span>
              <span className="faint" style={{ fontSize:14, fontWeight:600 }}>{p.price===0?'forever':`${p.unit||''}/mo`}</span>
            </div>
            <span className="faint" style={{ fontSize:12 }}>{p.price>0 && annual ? 'billed annually' : '\u00a0'}</span>
            <button className={`btn ${p.ctaStyle} btn-lg`} style={{ width:'100%', margin:'16px 0 18px', ...(p.popular?{background:'var(--pc)',color:'#fff'}:{}) }}
              onClick={()=>{
                if (p.id==='free') { setPlan('free'); showToast('You’re on the Free plan', 'check'); return; }
                const target = p.id==='pro' ? 'premium' : 'plus';
                setPlan(target);
                showToast(`${p.name} unlocked — features are on`, 'spark');
                go('library');
              }}>{p.id!=='free' && (p.id==='pro'?plan==='premium':plan!=='free') ? 'Current plan' : p.cta}</button>
            <div className="stack" style={{ gap:11 }}>
              {p.features.map((f,i)=>(
                <div key={i} className="row" style={{ gap:10, alignItems:'flex-start' }}>
                  <span className="center" style={{ width:22, height:22, borderRadius:7, background:'color-mix(in srgb,var(--pc) 14%, transparent)', color:'var(--pc)', flex:'none', marginTop:1 }}><Icon name={f[0]} size={13} /></span>
                  <span style={{ fontSize:13.5, lineHeight:1.4, fontWeight: f[1].endsWith('plus:')?700:500 }}>{f[1]}</span>
                </div>
              ))}
            </div>
            <span className="faint" style={{ fontSize:11.5, display:'block', marginTop:16 }}>{p.note}</span>
          </div>
        ))}
      </div>

      {/* trust + faq strip */}
      <div className="card card-pad" style={{ marginTop:'var(--gap)', background:'var(--surface-2)' }}>
        <div className="grid g-3" style={{ gap:'var(--gap)' }}>
          {[
            ['lock','Private by default','Your audio is encrypted and never used to train shared models — on every plan.'],
            ['refresh','Cancel anytime','Downgrade and your captures + 30-day history stay free, always.'],
            ['heart','Fair & flexible','Switch between personal and business billing as your needs change.'],
          ].map((x,i)=>(
            <div key={i} className="row" style={{ gap:12, alignItems:'flex-start' }}>
              <span className="center" style={{ width:38, height:38, borderRadius:11, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name={x[0]} size={19} /></span>
              <div className="stack" style={{ gap:2 }}>
                <span style={{ fontWeight:650, fontSize:13.5 }}>{x[1]}</span>
                <span className="faint" style={{ fontSize:12.5, lineHeight:1.45 }}>{x[2]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Pricing });


export { Pricing };
