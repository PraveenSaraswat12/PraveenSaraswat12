import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   LUMEN — Auth: sign up / log in (Google, email, phone OTP)
   ============================================================ */
function OtpInput({ value, onChange, length = 6 }) {
  const refs = React.useRef([]);
  const set = (i, v) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[i] = d;
    const next = arr.join('').slice(0, length);
    onChange(next);
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const onPaste = (e) => {
    const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length);
    if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(t.length, length - 1)]?.focus(); }
  };
  return (
    <div className="otp-row" onPaste={onPaste}>
      {Array.from({ length }).map((_, i) => (
        <input key={i} ref={el => refs.current[i] = el} className="otp-box" inputMode="numeric"
          maxLength={1} value={value[i] || ''} onChange={e => set(i, e.target.value)} onKeyDown={e => onKey(i, e)}
          aria-label={`Digit ${i + 1}`} />
      ))}
    </div>
  );
}

const COUNTRIES = [
  { iso:'US', name:'United States', dial:'+1' },
  { iso:'CA', name:'Canada', dial:'+1' },
  { iso:'GB', name:'United Kingdom', dial:'+44' },
  { iso:'IN', name:'India', dial:'+91' },
  { iso:'AU', name:'Australia', dial:'+61' },
  { iso:'DE', name:'Germany', dial:'+49' },
  { iso:'FR', name:'France', dial:'+33' },
  { iso:'ES', name:'Spain', dial:'+34' },
  { iso:'NL', name:'Netherlands', dial:'+31' },
  { iso:'AE', name:'United Arab Emirates', dial:'+971' },
  { iso:'SG', name:'Singapore', dial:'+65' },
  { iso:'JP', name:'Japan', dial:'+81' },
  { iso:'BR', name:'Brazil', dial:'+55' },
  { iso:'MX', name:'Mexico', dial:'+52' },
  { iso:'NG', name:'Nigeria', dial:'+234' },
  { iso:'ZA', name:'South Africa', dial:'+27' },
];

function CountrySelect({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const cur = COUNTRIES.find(c => c.iso === value) || COUNTRIES[0];
  const list = COUNTRIES.filter(c => {
    const s = q.trim().toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || c.dial.includes(s) || c.iso.toLowerCase().includes(s);
  });
  return (
    <div className="cc-select" ref={ref}>
      <button type="button" className="cc-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="cc-iso">{cur.iso}</span>
        <span className="tnum">{cur.dial}</span>
        <Icon name="chevD" size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform .18s', color:'var(--ink-3)' }} />
      </button>
      {open && (
        <div className="cc-menu">
          <div className="cc-search">
            <Icon name="search" size={15} />
            <input autoFocus placeholder="Search country or code" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="cc-list scroll">
            {list.length ? list.map(c => (
              <button key={c.iso} type="button" className={`cc-item ${c.iso === value ? 'on' : ''}`} onClick={() => { onChange(c.iso); setOpen(false); setQ(''); }}>
                <span className="cc-iso">{c.iso}</span>
                <span className="grow" style={{ textAlign:'left' }}>{c.name}</span>
                <span className="faint tnum">{c.dial}</span>
                {c.iso === value && <Icon name="check" size={14} stroke={2.6} />}
              </button>
            )) : <div className="faint" style={{ padding:'12px', fontSize:12.5, textAlign:'center' }}>No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Auth() {
  const { t, setTweak, go, flow } = useApp();
  const next = flow.authNext || 'onboarding';
  const [tab, setTab] = React.useState(flow.authMode || 'signup');
  const [method, setMethod] = React.useState('email');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [country, setCountry] = React.useState('US');
  const [otp, setOtp] = React.useState('');
  const [phoneStep, setPhoneStep] = React.useState('enter');
  const [busy, setBusy] = React.useState(false);
  const [resendIn, setResendIn] = React.useState(0);

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const finish = (label) => { setBusy(true); setTimeout(() => { go(next); }, 700); };
  const sendCode = () => { if (phone.replace(/\D/g,'').length < 7) return; setPhoneStep('otp'); setResendIn(30); };
  React.useEffect(() => { if (phoneStep === 'otp' && otp.length === 6) finish('phone'); }, [otp, phoneStep]);

  const isSignup = tab === 'signup';
  const emailOk = /.+@.+\..+/.test(email);
  const dial = (COUNTRIES.find(c => c.iso === country) || COUNTRIES[0]).dial;

  return (
    <div className="ob scroll" style={{ height:'100%', overflowY:'auto' }}>
      <header className="ob-top" style={{ maxWidth:1080 }}>
        <button className="row click" style={{ gap:9, background:'none', border:0 }} onClick={()=>go('landing')}>
          <LumenMark size={28} /><span style={{ fontFamily:'var(--font-display)', fontSize:19, fontWeight:600 }}>Kithra</span>
        </button>
        <button className="btn btn-icon btn-ghost" onClick={()=>setTweak('theme', t.theme==='dark'?'light':'dark')} aria-label="Theme"><Icon name={t.theme==='dark'?'sun':'moon'} size={18} /></button>
      </header>

      <main className="auth-wrap">
        {/* brand side */}
        <div className="auth-aside">
          <div className="auth-aside-glow" />
          <div style={{ position:'relative', zIndex:1 }}>
            <span className="badge badge-accent" style={{ height:28, padding:'0 13px' }}><Icon name="lock" size={13} />Private by design</span>
            <h1 className="display" style={{ fontSize:'clamp(28px,3vw,40px)', margin:'20px 0 0', lineHeight:1.1 }}>
              Your conversations,<br />finally understood
            </h1>
            <p className="muted" style={{ fontSize:15, margin:'16px 0 28px', lineHeight:1.6, maxWidth:380 }}>
              Sign in to turn your recordings into clear patterns, signals, and next steps — kept encrypted and entirely yours.
            </p>
            <div style={{ height:46, maxWidth:340, opacity:.9 }}><Waveform bars={52} seed={6} height={46} gap={3} /></div>
            <div className="stack" style={{ gap:13, marginTop:30 }}>
              {[['lock','End-to-end encrypted'],['shield','Never used to train shared models'],['trash','Delete anything, anytime']].map((x,i)=>(
                <div key={i} className="row" style={{ gap:11 }}>
                  <span className="center" style={{ width:30, height:30, borderRadius:9, background:'var(--good-soft)', color:'var(--good)', flex:'none' }}><Icon name={x[0]} size={16} /></span>
                  <span style={{ fontSize:13.5, fontWeight:500 }}>{x[1]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* form side */}
        <div className="auth-card card">
          <div className="auth-tabs">
            <button className={isSignup?'on':''} onClick={()=>setTab('signup')}>Create account</button>
            <button className={!isSignup?'on':''} onClick={()=>setTab('login')}>Log in</button>
          </div>

          <h2 className="display" style={{ fontSize:24, margin:'4px 0 4px' }}>{isSignup?'Get started with Kithra':'Welcome back'}</h2>
          <p className="faint" style={{ fontSize:13.5, margin:'0 0 20px' }}>{isSignup?'Free to start. No card required.':'Sign in to your private workspace.'}</p>

          {/* Google */}
          <button className="btn btn-ghost btn-lg auth-google" onClick={()=>finish('google')} disabled={busy}>
            <span className="g-badge"><Icon name="google" size={18} /></span>
            Continue with Google
          </button>

          <div className="auth-or"><span>or</span></div>

          {/* method switch */}
          <div className="seg" style={{ width:'100%', marginBottom:16 }}>
            <button className={method==='email'?'on':''} style={{ flex:1 }} onClick={()=>setMethod('email')}><Icon name="file" size={14} style={{marginRight:6}} />Email</button>
            <button className={method==='phone'?'on':''} style={{ flex:1 }} onClick={()=>{setMethod('phone');setPhoneStep('enter');}}><Icon name="mic" size={14} style={{marginRight:6}} />Phone</button>
          </div>

          {method==='email' ? (
            <div className="stack" style={{ gap:13 }}>
              {isSignup && (
                <label className="auth-field">
                  <span>Full name</span>
                  <input className="field" placeholder="Dana Rivera" value={name} onChange={e=>setName(e.target.value)} />
                </label>
              )}
              <label className="auth-field">
                <span>Email address</span>
                <input className="field" type="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <input className="field" type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} />
              </label>
              <button className="btn btn-primary btn-lg" style={{ width:'100%', marginTop:4 }} disabled={!emailOk || busy} onClick={()=>finish('email')}>
                {busy ? 'Signing you in…' : isSignup ? 'Create account' : 'Log in'} {!busy && <Icon name="arrowR" size={18} />}
              </button>
            </div>
          ) : (
            <div className="stack" style={{ gap:13 }}>
              {phoneStep==='enter' ? (
                <>
                  <label className="auth-field">
                    <span>Phone number</span>
                    <div className="phone-field">
                      <CountrySelect value={country} onChange={setCountry} />
                      <input className="field" inputMode="tel" placeholder="(555) 012-3456" value={phone} onChange={e=>setPhone(e.target.value)} style={{ border:0, height:'auto', padding:0 }} />
                    </div>
                  </label>
                  <button className="btn btn-primary btn-lg" style={{ width:'100%' }} disabled={phone.replace(/\D/g,'').length<7} onClick={sendCode}>
                    Send verification code <Icon name="send" size={17} />
                  </button>
                  <p className="faint" style={{ fontSize:12, textAlign:'center', margin:0 }}>We’ll text you a 6-digit code. Standard rates may apply.</p>
                </>
              ) : (
                <>
                  <div className="stack" style={{ gap:4 }}>
                    <span className="auth-field"><span>Enter the 6-digit code</span></span>
                    <p className="faint" style={{ fontSize:12.5, margin:'0 0 6px' }}>Sent to {dial} {phone || '(555) 012-3456'} · <button className="linkbtn" onClick={()=>setPhoneStep('enter')}>change</button></p>
                  </div>
                  <OtpInput value={otp} onChange={setOtp} />
                  <button className="btn btn-primary btn-lg" style={{ width:'100%' }} disabled={otp.length<6 || busy} onClick={()=>finish('phone')}>
                    {busy ? 'Verifying…' : 'Verify & continue'}
                  </button>
                  <p className="faint" style={{ fontSize:12.5, textAlign:'center', margin:0 }}>
                    {resendIn>0 ? <>Resend code in {resendIn}s</> : <button className="linkbtn" onClick={()=>setResendIn(30)}>Resend code</button>}
                  </p>
                </>
              )}
            </div>
          )}

          <p className="faint" style={{ fontSize:11.5, textAlign:'center', margin:'20px 0 0', lineHeight:1.5 }}>
            By continuing you agree to Kithra’s Terms & Privacy. This is a demo — any details work.
          </p>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { Auth });


export { Auth };
