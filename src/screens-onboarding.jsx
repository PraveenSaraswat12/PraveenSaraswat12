import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   LUMEN — Onboarding: Set Intent
   ============================================================ */
function Onboarding() {
  const { t, setTweak, go, flow, mode } = useApp();
  const { goals, setGoals, goalText, setGoalText } = flow;
  const chips = window.LUMEN.goals[mode];
  const toggle = (g) => setGoals(prev => prev.includes(g) ? prev.filter(x=>x!==g) : [...prev, g]);
  const isBiz = mode === 'business';

  return (
    <div className="ob scroll" style={{ height:'100%', overflowY:'auto', background:'var(--paper)' }}>
      <header className="ob-top">
        <button className="row click" style={{ gap:9, background:'none', border:0 }} onClick={()=>go('landing')}>
          <LumenMark size={28} /><span style={{ fontFamily:'var(--font-display)', fontSize:19, fontWeight:600 }}>Kithra</span>
        </button>
        <div className="ob-steps">
          <span className="ob-step on">Intent</span>
          <span className="ob-line" />
          <span className="ob-step">Import</span>
          <span className="ob-line" />
          <span className="ob-step">Insights</span>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={()=>setTweak('theme', t.theme==='dark'?'light':'dark')} aria-label="Theme"><Icon name={t.theme==='dark'?'sun':'moon'} size={18} /></button>
      </header>

      <main className="ob-main">
        <div className="ob-badge anim-up">
          <span className="center" style={{ width:30, height:30, borderRadius:9, background:'var(--accent)', color:'var(--accent-ink)' }}><Icon name={isBiz?'briefcase':'heart'} size={16} /></span>
          <span style={{ fontWeight:600, fontSize:13.5 }}>{isBiz?'Business mode':'Personal mode'}</span>
          <button className="ob-switch" onClick={()=>setTweak('mode', isBiz?'personal':'business')}>Switch</button>
        </div>

        <h1 className="display anim-up" style={{ fontSize:'clamp(30px,4vw,46px)', margin:'18px 0 0', animationDelay:'.05s', maxWidth:640 }}>
          What are you hoping to get out of this?
        </h1>
        <p className="muted anim-up" style={{ fontSize:16, margin:'14px 0 0', maxWidth:560, lineHeight:1.55, animationDelay:'.1s' }}>
          {isBiz
            ? 'Pick what matters most for your team. Kithra will tune its analysis and surface the insights you actually need.'
            : 'Choose what you\u2019d like to understand. Kithra will keep it gentle, private, and just for you.'}
        </p>

        <div className="ob-chips anim-up" style={{ animationDelay:'.16s' }}>
          {chips.map((g,i)=>(
            <button key={g} className={`ob-chip ${goals.includes(g)?'on':''}`} onClick={()=>toggle(g)}>
              <span className="ob-chip-check">{goals.includes(g) ? <Icon name="check" size={14} stroke={3} /> : <Icon name="plus" size={14} stroke={2.4} />}</span>
              {g}
            </button>
          ))}
        </div>

        <div className="ob-free anim-up" style={{ animationDelay:'.22s' }}>
          <label className="eyebrow" style={{ marginBottom:8, display:'block' }}>In your own words (optional)</label>
          <div className="row" style={{ gap:10, alignItems:'flex-start' }}>
            <span className="center" style={{ width:44, height:44, borderRadius:'var(--r-ctrl)', background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name="quote" size={20} /></span>
            <textarea className="field" rows={2} placeholder={isBiz?'e.g. I want to understand why we keep losing late-stage deals…':'e.g. I want to be more present and less reactive in conversations…'}
              value={goalText} onChange={e=>setGoalText(e.target.value)} style={{ flex:1 }} />
          </div>
        </div>

        <div className="ob-actions anim-up" style={{ animationDelay:'.28s' }}>
          <button className="btn btn-ghost btn-lg" onClick={()=>go('landing')}>Back</button>
          <div className="row" style={{ gap:14 }}>
            <span className="faint" style={{ fontSize:13 }}>{goals.length>0 ? `${goals.length} selected` : 'Pick at least one to continue'}</span>
            <button className="btn btn-primary btn-lg" disabled={goals.length===0 && !goalText.trim()} style={{ opacity:(goals.length===0 && !goalText.trim())?0.5:1 }} onClick={()=>go('import')}>
              Continue <Icon name="arrowR" size={18} />
            </button>
          </div>
        </div>

        <div className="ob-trust anim-in" style={{ animationDelay:'.34s' }}>
          <PrivacyChip text="Nothing is uploaded yet — and everything you add stays encrypted and private to you." />
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { Onboarding });


export { Onboarding };
