import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   LUMEN — Landing / Home (2 hero variations)
   ============================================================ */
function Landing() {
  const { t, setTweak, go, flow } = useApp();
  const enter = (mode) => { setTweak('mode', mode); flow.setAuthMode('signup'); flow.setAuthNext('onboarding'); go('auth'); };
  const hero = t.heroVariant || 'A';

  return (
    <div className="lp scroll" style={{ height:'100%', overflowY:'auto', background:'var(--paper)' }}>
      {/* top nav */}
      <header className="lp-nav">
        <Wordmark size={30} />
        <nav className="lp-links">
          <a href="#how" onClick={(e)=>{e.preventDefault();document.getElementById('how')?.scrollIntoView?.({behavior:'smooth'});}}>How it works</a>
          <a href="#modes" onClick={(e)=>{e.preventDefault();document.getElementById('modes')?.scrollIntoView?.({behavior:'smooth'});}}>Two modes</a>
          <a href="#trust" onClick={(e)=>{e.preventDefault();document.getElementById('trust')?.scrollIntoView?.({behavior:'smooth'});}}>Privacy</a>
        </nav>
        <div className="row" style={{ gap:10 }}>
          <button className="btn btn-icon btn-ghost" onClick={()=>setTweak('theme', t.theme==='dark'?'light':'dark')} aria-label="Theme">
            <Icon name={t.theme==='dark'?'sun':'moon'} size={18} />
          </button>
          <button className="btn btn-soft btn-sm" onClick={()=>{flow.setAuthMode('login');flow.setAuthNext('dashboard');go('auth');}}>Sign in</button>
          <button className="btn btn-primary btn-sm" onClick={()=>{flow.setAuthMode('signup');flow.setAuthNext('onboarding');go('auth');}}>Get started</button>
        </div>
      </header>

      {hero === 'A' ? <HeroCentered enter={enter} /> : <HeroSplit enter={enter} />}

      {/* flow explainer */}
      <section id="how" className="lp-sec">
        <div className="lp-eyebrow"><span className="eyebrow">How it works</span></div>
        <h2 className="display h2" style={{ textAlign:'center', maxWidth:720, margin:'10px auto 6px' }}>
          From raw recordings to clear next steps
        </h2>
        <p className="lp-lead">Three simple stages. You stay in control the whole way.</p>
        <div className="grid g-3" style={{ marginTop:40 }}>
          {[
            { ic:'mic', n:'01', t:'Capture your conversations', d:'Turn on live capture and Kithra records and transcribes in the background — on mobile, even when your phone is locked. Import existing audio files too.' },
            { ic:'wave', n:'02', t:'Kithra listens & analyzes', d:'We transcribe every conversation and study tone, patterns, and moments that matter — privately.' },
            { ic:'spark', n:'03', t:'Get tailored insights', d:'Tell Kithra what you want, and get clear findings plus a recommended next action you can act on.' },
          ].map((s,i)=>(
            <div key={i} className="card card-pad card-hover anim-up" style={{ animationDelay:`${i*0.08}s` }}>
              <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-start' }}>
                <span className="center" style={{ width:46, height:46, borderRadius:'var(--r-ctrl)', background:'var(--accent-soft)', color:'var(--accent-strong)' }}>
                  <Icon name={s.ic} size={22} />
                </span>
                <span className="display" style={{ fontSize:30, color:'var(--line-2)' }}>{s.n}</span>
              </div>
              <h3 style={{ margin:'18px 0 8px', fontSize:18, fontWeight:700, letterSpacing:'-.01em' }}>{s.t}</h3>
              <p className="muted" style={{ margin:0, fontSize:14, lineHeight:1.55 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* two modes */}
      <section id="modes" className="lp-sec">
        <div className="lp-eyebrow"><span className="eyebrow">One product, two minds</span></div>
        <h2 className="display h2" style={{ textAlign:'center', maxWidth:760, margin:'10px auto 6px' }}>
          For closing deals, and for knowing yourself
        </h2>
        <p className="lp-lead">Switch modes any time. The whole workspace re-themes to match.</p>
        <div className="grid g-2" style={{ marginTop:40 }}>
          <ModeCard mode="business" accent="#3a6df4" icon="briefcase"
            title="For my business"
            blurb="Upload a thousand customer calls and Kithra surfaces what wins versus loses deals, the objections that recur, and the next best action for every prospect."
            points={['Patterns that win deals','Objection & sentiment tracking','Recommended next actions']}
            onGo={()=>enter('business')} />
          <ModeCard mode="personal" accent="#f5734f" icon="heart"
            title="For myself"
            blurb="Record daily conversations and reflections, and Kithra helps you understand your communication style, recurring habits, and emotional tone — gently, never judging."
            points={['Habits & behavior patterns','Emotional tone over time','Small, kind steps to try']}
            onGo={()=>enter('personal')} />
        </div>
      </section>

      {/* trust strip */}
      <section id="trust" className="lp-trust">
        <div className="lp-trust-inner card">
          <div className="stack" style={{ gap:6, maxWidth:380 }}>
            <span className="eyebrow" style={{ color:'var(--accent-strong)' }}>Privacy first</span>
            <h3 className="display" style={{ fontSize:26, margin:0 }}>Your conversations stay yours</h3>
          </div>
          <div className="lp-trust-items">
            {[
              { ic:'lock', t:'End-to-end encrypted', d:'Audio is encrypted in transit and at rest.' },
              { ic:'shield', t:'Your data stays yours', d:'Never used to train shared models.' },
              { ic:'trash', t:'Delete anytime', d:'One click removes a recording for good.' },
            ].map((x,i)=>(
              <div key={i} className="lp-trust-item">
                <span className="center" style={{ width:38, height:38, borderRadius:11, background:'var(--good-soft)', color:'var(--good)', flex:'none' }}>
                  <Icon name={x.ic} size={19} />
                </span>
                <div className="stack" style={{ gap:2 }}>
                  <span style={{ fontWeight:700, fontSize:14 }}>{x.t}</span>
                  <span className="faint" style={{ fontSize:12.5 }}>{x.d}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta">
        <h2 className="display h2" style={{ margin:'0 0 14px' }}>Hear what your conversations are telling you</h2>
        <p className="lp-lead" style={{ marginBottom:26 }}>Start free. Bring one recording or a thousand.</p>
        <div className="row" style={{ gap:12, justifyContent:'center' }}>
          <button className="btn btn-primary btn-lg" onClick={()=>enter('business')}><Icon name="briefcase" size={18} />For my business</button>
          <button className="btn btn-ghost btn-lg" onClick={()=>enter('personal')}><Icon name="heart" size={18} />For myself</button>
        </div>
      </section>

      <footer className="lp-foot">
        <Wordmark size={24} />
        <span className="faint" style={{ fontSize:12.5 }}>© 2026 Kithra — conversation intelligence, privately.</span>
      </footer>
    </div>
  );
}

/* ---------- Hero A: centered ---------- */
function HeroCentered({ enter }) {
  return (
    <section className="lp-hero center-hero">
      <div className="lp-glow" />
      <span className="badge badge-accent anim-up" style={{ height:28, padding:'0 13px', fontSize:12.5 }}>
        <Icon name="lock" size={13} /> Private by design
      </span>
      <h1 className="display h1 anim-up" style={{ animationDelay:'.05s', maxWidth:900, margin:'20px auto 0', lineHeight:1.1 }}>
        Turn your conversations into <em style={{ fontStyle:'italic', color:'var(--accent-strong)' }}>clarity</em>
      </h1>
      <p className="lp-lead anim-up" style={{ animationDelay:'.12s', maxWidth:620, marginTop:30 }}>
        Kithra transcribes and analyzes your recorded calls, meetings, and reflections — then returns the patterns, signals, and next steps that actually matter.
      </p>
      <div className="row anim-up" style={{ gap:12, justifyContent:'center', marginTop:30, animationDelay:'.18s', flexWrap:'wrap' }}>
        <button className="btn btn-primary btn-lg" onClick={()=>enter('business')}><Icon name="briefcase" size={18} />For my business</button>
        <button className="btn btn-ghost btn-lg" onClick={()=>enter('personal')}><Icon name="heart" size={18} />For myself</button>
      </div>
      <div className="lp-hero-visual card anim-up" style={{ animationDelay:'.26s' }}>
        <HeroVisual />
      </div>
    </section>
  );
}

/* ---------- Hero B: split ---------- */
function HeroSplit({ enter }) {
  return (
    <section className="lp-hero split-hero">
      <div className="lp-glow left" />
      <div className="split-left">
        <span className="badge badge-accent anim-up" style={{ height:28, padding:'0 13px', fontSize:12.5 }}>
          <Icon name="lock" size={13} /> Private by design
        </span>
        <h1 className="display h1 anim-up" style={{ animationDelay:'.05s', marginTop:18 }}>
          The quiet intelligence inside every conversation
        </h1>
        <p className="lp-lead anim-up" style={{ animationDelay:'.12s', margin:'18px 0 0', maxWidth:520 }}>
          Bring your recordings. Kithra listens, finds the patterns, and tells you what to do next — for your business or for yourself.
        </p>
        <div className="row anim-up" style={{ gap:12, marginTop:30, animationDelay:'.18s', flexWrap:'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={()=>enter('business')}><Icon name="briefcase" size={18} />For my business</button>
          <button className="btn btn-ghost btn-lg" onClick={()=>enter('personal')}><Icon name="heart" size={18} />For myself</button>
        </div>
        <div className="row" style={{ gap:20, marginTop:30, flexWrap:'wrap' }}>
          <PrivacyChip text="End-to-end encrypted" />
          <PrivacyChip text="Delete anytime" />
        </div>
      </div>
      <div className="split-right card anim-up" style={{ animationDelay:'.26s' }}>
        <HeroVisual />
      </div>
    </section>
  );
}

/* ---------- Shared hero product visual ---------- */
function HeroVisual() {
  return (
    <div className="hero-visual-inner">
      <div className="row" style={{ justifyContent:'space-between', marginBottom:14 }}>
        <div className="row" style={{ gap:9 }}>
          <Avatar label="MH" color="#5566d6" size={30} />
          <div className="stack">
            <span style={{ fontWeight:700, fontSize:13.5 }}>Meridian Health</span>
            <span className="faint" style={{ fontSize:11.5 }}>Pricing review · 32:14</span>
          </div>
        </div>
        <Badge kind="good" dot>Positive</Badge>
      </div>
      <div style={{ height:54, padding:'8px 0' }}>
        <Waveform bars={56} seed={4} height={38} progress={0.62} gap={3} />
      </div>
      <div className="hero-insight">
        <span className="center" style={{ width:30, height:30, borderRadius:9, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}>
          <Icon name="spark" size={16} />
        </span>
        <div className="stack" style={{ gap:2 }}>
          <span style={{ fontWeight:600, fontSize:13 }}>Next best action</span>
          <span className="muted" style={{ fontSize:12.5, lineHeight:1.4 }}>Send the ROI one-pager while sentiment is high, then propose a phased rollout.</span>
        </div>
      </div>
      <div className="grid g-3" style={{ gap:10, marginTop:12 }}>
        {[['Win signal','+28%','var(--viz-2)'],['Objection','Budget','var(--viz-3)'],['Sentiment','+0.41','var(--viz-1)']].map((m,i)=>(
          <div key={i} className="hero-mini">
            <span className="faint" style={{ fontSize:10.5, fontWeight:600 }}>{m[0]}</span>
            <span className="metric-num" style={{ fontSize:18, color:m[2] }}>{m[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- mode card ---------- */
function ModeCard({ mode, accent, icon, title, blurb, points, onGo }) {
  return (
    <div className="card card-pad card-hover mode-card" data-accent-preview={mode}
      style={{ '--accent': accent, '--accent-soft': `color-mix(in srgb, ${accent} 13%, var(--surface))` }}>
      <div className="row" style={{ gap:12, marginBottom:16 }}>
        <span className="center" style={{ width:48, height:48, borderRadius:14, background:accent, color:'#fff', flex:'none' }}>
          <Icon name={icon} size={23} />
        </span>
        <h3 style={{ margin:0, fontSize:21, fontWeight:700, letterSpacing:'-.01em' }}>{title}</h3>
      </div>
      <p className="muted" style={{ margin:'0 0 18px', fontSize:14.5, lineHeight:1.6 }}>{blurb}</p>
      <div className="stack" style={{ gap:10, marginBottom:22 }}>
        {points.map((p,i)=>(
          <div key={i} className="row" style={{ gap:10 }}>
            <span className="center" style={{ width:20, height:20, borderRadius:6, background:`color-mix(in srgb,${accent} 16%, transparent)`, color:accent, flex:'none' }}>
              <Icon name="check" size={13} stroke={2.6} />
            </span>
            <span style={{ fontSize:14, fontWeight:500 }}>{p}</span>
          </div>
        ))}
      </div>
      <button className="btn btn-lg" style={{ background:accent, color:'#fff', width:'100%' }} onClick={onGo}>
        Start in this mode <Icon name="arrowR" size={18} />
      </button>
    </div>
  );
}

Object.assign(window, { Landing });


export { Landing };
