import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   KITHRA — Auth: REAL sign in / sign up (Supabase email+password)
   Rendered as a route (#auth) and as the in-app login gate.
   ============================================================ */
function Auth({ gate }) {
  const { go, refreshUser, setLocalOnly, grantConsent, showToast, flow } = useApp();
  const Cloud = window.KithraCloud;
  const configured = !!(Cloud && Cloud.configured && Cloud.configured());
  const [kind, setKind] = React.useState((flow && flow.authMode) === 'login' ? 'in' : 'up');
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [notice, setNotice] = React.useState('');

  const submit = async () => {
    setErr(''); setNotice('');
    const em = email.trim();
    if (!/.+@.+\..+/.test(em)) { setErr('Enter a valid email address.'); return; }
    if ((pw || '').length < 6) { setErr('Password needs at least 6 characters.'); return; }
    if (!configured) { setErr('Cloud isn’t configured on this build.'); return; }
    setBusy(true);
    try {
      await (kind === 'up' ? Cloud.signUp(em, pw) : Cloud.signIn(em, pw));
      const u = await refreshUser();
      if (u) {
        grantConsent('cloud_sync'); // account sync is the purpose of signing in — recorded in the ledger
        showToast(kind === 'up' ? 'Welcome to Kithra' : 'Signed in', 'check');
        go('dashboard');
      } else {
        setNotice('Almost there — confirm the email we just sent you, then sign in here.');
        setKind('in');
      }
    } catch (e) {
      const m = (e && e.message) || String(e);
      setErr(/already registered/i.test(m) ? 'That email already has an account — sign in instead.' : m);
      if (/already registered/i.test(m)) setKind('in');
    }
    setBusy(false);
  };

  return (
    <div className="scroll" style={{ minHeight:'100%', overflow:'auto', display:'grid', placeItems:'center', background:'var(--paper)', padding:'34px 16px' }}>
      <div className="stack" style={{ width:'min(420px, 94vw)', gap:18 }}>
        <div className="stack center" style={{ gap:10, textAlign:'center' }}>
          <button style={{ border:0, background:'transparent', cursor:'pointer' }} onClick={()=>go('landing')} aria-label="Kithra home"><Wordmark size={34} /></button>
          <span className="faint" style={{ fontSize:13.5, fontStyle:'italic', fontFamily:'var(--font-display)' }}>Where talk becomes insight</span>
        </div>

        <div className="card card-pad anim-up" style={{ padding:'26px 24px' }}>
          <div className="seg" style={{ width:'100%', marginBottom:18 }}>
            <button className={kind==='up'?'on':''} style={{ flex:1 }} onClick={()=>{ setKind('up'); setErr(''); }}>Create account</button>
            <button className={kind==='in'?'on':''} style={{ flex:1 }} onClick={()=>{ setKind('in'); setErr(''); }}>Sign in</button>
          </div>
          <div className="stack" style={{ gap:12 }}>
            <label className="stack" style={{ gap:5 }}><span className="eyebrow">Email</span>
              <input className="field" style={{ height:44 }} type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"
                onKeyDown={e=>{ if(e.key==='Enter') submit(); }} /></label>
            <label className="stack" style={{ gap:5 }}><span className="eyebrow">Password</span>
              <div className="row" style={{ gap:8 }}>
                <input className="field grow" style={{ height:44 }} type={show?'text':'password'} autoComplete={kind==='up'?'new-password':'current-password'} value={pw} onChange={e=>setPw(e.target.value)} placeholder={kind==='up'?'Choose a password (6+ characters)':'Your password'}
                  onKeyDown={e=>{ if(e.key==='Enter') submit(); }} />
                <button className="btn btn-soft btn-icon" style={{ height:44, width:44, flex:'none' }} onClick={()=>setShow(s=>!s)} aria-label={show?'Hide password':'Show password'}><Icon name="eye" size={17} /></button>
              </div></label>
            {err && <div className="row" style={{ gap:8, color:'var(--bad)', fontSize:13 }}><Icon name="x" size={14} />{err}</div>}
            {notice && <div className="row" style={{ gap:8, color:'var(--good)', fontSize:13 }}><Icon name="check" size={14} />{notice}</div>}
            <button className="btn btn-primary btn-lg" style={{ width:'100%' }} disabled={busy} onClick={submit}>
              {busy ? 'One moment…' : kind==='up' ? <><Icon name="user" size={17} />Create my account</> : <><Icon name="arrowR" size={17} />Sign in</>}
            </button>
          </div>
          <div className="hr" style={{ margin:'18px 0 12px' }} />
          <div className="stack" style={{ gap:8 }}>
            <PrivacyChip text="Your account stores only what you choose to sync" />
            <button className="linkbtn" style={{ fontSize:12.5, alignSelf:'flex-start' }}
              onClick={()=>{ setLocalOnly(true); showToast('Using Kithra offline — everything stays on this device', 'shield'); go('dashboard'); }}>
              Skip for now — use offline (local only)
            </button>
          </div>
        </div>

        <div className="center"><button className="linkbtn" style={{ fontSize:12.5 }} onClick={()=>go('landing')}><Icon name="chevL" size={13} /> Back to home</button></div>
      </div>
    </div>
  );
}

Object.assign(window, { Auth });

export { Auth };
