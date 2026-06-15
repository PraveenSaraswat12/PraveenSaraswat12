import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   KITHRA — Auth: REAL sign in / sign up
   Three real methods (all Supabase Auth):
     · Continue with Google  (OAuth redirect)
     · Phone number + OTP    (SMS one-time code)
     · Email + password
   Rendered as a route (#auth) and as the in-app login gate.
   No offline / local-only escape — an account is required.
   ============================================================ */

// little brand "G" so the Google button reads at a glance without an asset
function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
      <path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 2.97 29.93 1 24 1 15.4 1 7.96 5.93 4.34 14.12l7.35 5.7C13.42 13.62 18.27 9.75 24 9.75z"/>
    </svg>
  );
}

function Auth({ gate }) {
  const { go, refreshUser, grantConsent, showToast, flow } = useApp();
  const Cloud = window.KithraCloud;
  const configured = !!(Cloud && Cloud.configured && Cloud.configured());

  const [method, setMethod] = React.useState('email'); // 'email' | 'phone'
  const [kind, setKind] = React.useState((flow && flow.authMode) === 'login' ? 'in' : 'up');

  // email + password
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [show, setShow] = React.useState(false);

  // phone + otp
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [otpSent, setOtpSent] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [notice, setNotice] = React.useState('');

  // password recovery (returning from a reset email)
  const [recovery, setRecovery] = React.useState(false);
  const [newPw, setNewPw] = React.useState('');

  const arrive = async (welcome) => {
    const u = await refreshUser();
    if (u) {
      grantConsent('cloud_sync'); // account sync is the purpose of signing in — recorded in the ledger
      showToast(welcome, 'check');
      go('dashboard');
    }
    return u;
  };

  // returning from a password-reset email puts the app in recovery mode
  React.useEffect(() => {
    if (!configured) return;
    let off;
    try { if (/type=recovery/.test(window.location.hash || '')) setRecovery(true); } catch (e) {}
    if (Cloud.onPasswordRecovery) Cloud.onPasswordRecovery(() => setRecovery(true)).then((fn) => { off = fn; }).catch(() => {});
    return () => { try { off && off(); } catch (e) {} };
  }, [configured]);

  // ---- Google ----
  const google = async () => {
    setErr(''); setNotice('');
    if (!configured) { setErr('Cloud isn’t configured on this build.'); return; }
    setBusy(true);
    try { await Cloud.signInWithGoogle(); /* redirects away; session resolves on return */ }
    catch (e) { setErr((e && e.message) || String(e)); setBusy(false); }
  };

  // ---- email ----
  const submitEmail = async () => {
    setErr(''); setNotice('');
    const em = email.trim();
    if (!/.+@.+\..+/.test(em)) { setErr('Enter a valid email address.'); return; }
    if ((pw || '').length < 6) { setErr('Password needs at least 6 characters.'); return; }
    if (!configured) { setErr('Cloud isn’t configured on this build.'); return; }
    setBusy(true);
    try {
      await (kind === 'up' ? Cloud.signUp(em, pw) : Cloud.signIn(em, pw));
      const u = await arrive(kind === 'up' ? 'Welcome to Kithra' : 'Signed in');
      if (!u) { setNotice('Almost there — confirm the email we just sent you, then sign in here.'); setKind('in'); }
    } catch (e) {
      const m = (e && e.message) || String(e);
      setErr(/already registered/i.test(m) ? 'That email already has an account — sign in instead.' : m);
      if (/already registered/i.test(m)) setKind('in');
    }
    setBusy(false);
  };

  // ---- phone OTP ----
  const e164 = (p) => { const s = String(p).replace(/[^\d+]/g, ''); return s.startsWith('+') ? s : '+' + s; };
  const sendOtp = async () => {
    setErr(''); setNotice('');
    const p = e164(phone);
    if (p.replace(/\D/g, '').length < 8) { setErr('Enter your phone number with country code, e.g. +1 555 012 3456.'); return; }
    if (!configured) { setErr('Cloud isn’t configured on this build.'); return; }
    setBusy(true);
    try { await Cloud.sendPhoneOtp(p); setOtpSent(true); setNotice('We texted a 6-digit code to ' + p + '.'); }
    catch (e) { setErr((e && e.message) || String(e)); }
    setBusy(false);
  };
  const verifyOtp = async () => {
    setErr(''); setNotice('');
    if ((code || '').replace(/\D/g, '').length < 4) { setErr('Enter the code from the text message.'); return; }
    setBusy(true);
    try {
      await Cloud.verifyPhoneOtp(e164(phone), code.trim());
      const u = await arrive('Signed in');
      if (!u) setErr('That code didn’t match — try again.');
    } catch (e) { setErr((e && e.message) || String(e)); }
    setBusy(false);
  };

  // ---- forgot / reset password ----
  const forgot = async () => {
    setErr(''); setNotice('');
    const em = email.trim();
    if (!/.+@.+\..+/.test(em)) { setErr('Type your email above first, then tap “Forgot password”.'); return; }
    if (!configured) { setErr('Cloud isn’t configured on this build.'); return; }
    setBusy(true);
    try { await Cloud.resetPassword(em); setNotice('We’ve emailed you a reset link — open it on this device to set a new password.'); }
    catch (e) { setErr((e && e.message) || String(e)); }
    setBusy(false);
  };
  const setNewPassword = async () => {
    setErr(''); setNotice('');
    if ((newPw || '').length < 6) { setErr('New password needs at least 6 characters.'); return; }
    setBusy(true);
    try { await Cloud.updatePassword(newPw); setRecovery(false); await arrive('Password updated'); }
    catch (e) { setErr((e && e.message) || String(e)); }
    setBusy(false);
  };

  const onKey = (fn) => (e) => { if (e.key === 'Enter') fn(); };

  return (
    <div className="scroll" style={{ minHeight:'100%', overflow:'auto', display:'grid', placeItems:'center', background:'var(--paper)', padding:'34px 16px' }}>
      <div className="stack" style={{ width:'min(420px, 94vw)', gap:18 }}>
        <div className="stack center" style={{ gap:10, textAlign:'center' }}>
          <button style={{ border:0, background:'transparent', cursor:'pointer' }} onClick={()=>go('landing')} aria-label="Kithra home"><Wordmark size={34} /></button>
          <span className="faint" style={{ fontSize:13.5, fontStyle:'italic', fontFamily:'var(--font-display)' }}>Where talk becomes insight</span>
        </div>

        <div className="card card-pad anim-up" style={{ padding:'26px 24px' }}>
          {recovery ? (
            <div className="stack" style={{ gap:12 }}>
              <div className="stack" style={{ gap:4 }}>
                <h2 className="display" style={{ fontSize:20, margin:0 }}>Set a new password</h2>
                <p className="muted" style={{ margin:0, fontSize:13, lineHeight:1.5 }}>You followed a reset link. Choose a new password to finish signing in.</p>
              </div>
              <label className="stack" style={{ gap:5 }}><span className="eyebrow">New password</span>
                <div className="row" style={{ gap:8 }}>
                  <input className="field grow" style={{ height:44 }} type={show?'text':'password'} autoComplete="new-password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="At least 6 characters" onKeyDown={onKey(setNewPassword)} />
                  <button className="btn btn-soft btn-icon" style={{ height:44, width:44, flex:'none' }} onClick={()=>setShow(s=>!s)} aria-label={show?'Hide password':'Show password'}><Icon name="eye" size={17} /></button>
                </div></label>
              {err && <div className="row" style={{ gap:8, color:'var(--bad)', fontSize:13 }}><Icon name="x" size={14} />{err}</div>}
              {notice && <div className="row" style={{ gap:8, color:'var(--good)', fontSize:13 }}><Icon name="check" size={14} />{notice}</div>}
              <button className="btn btn-primary btn-lg" style={{ width:'100%' }} disabled={busy} onClick={setNewPassword}>{busy?'Saving…':<><Icon name="check" size={17} />Save new password</>}</button>
            </div>
          ) : (<>
          {/* Google first — fastest path */}
          <button className="btn btn-lg" style={{ width:'100%', gap:10, background:'#fff', color:'#1f2430', border:'1px solid var(--line)', fontWeight:600 }} disabled={busy} onClick={google}>
            <GoogleG size={18} /> Continue with Google
          </button>

          <div className="row" style={{ alignItems:'center', gap:10, margin:'16px 0' }}>
            <span className="hr grow" style={{ margin:0 }} />
            <span className="faint" style={{ fontSize:11.5 }}>or</span>
            <span className="hr grow" style={{ margin:0 }} />
          </div>

          {/* Email / Phone method toggle */}
          <div className="seg" style={{ width:'100%', marginBottom:16 }}>
            <button className={method==='email'?'on':''} style={{ flex:1 }} onClick={()=>{ setMethod('email'); setErr(''); setNotice(''); }}><Icon name="file" size={14} /> Email</button>
            <button className={method==='phone'?'on':''} style={{ flex:1 }} onClick={()=>{ setMethod('phone'); setErr(''); setNotice(''); }}><Icon name="phone" size={14} /> Phone</button>
          </div>

          {method === 'email' ? (
            <div className="stack" style={{ gap:12 }}>
              <div className="seg" style={{ width:'100%' }}>
                <button className={kind==='up'?'on':''} style={{ flex:1 }} onClick={()=>{ setKind('up'); setErr(''); }}>Create account</button>
                <button className={kind==='in'?'on':''} style={{ flex:1 }} onClick={()=>{ setKind('in'); setErr(''); }}>Sign in</button>
              </div>
              <label className="stack" style={{ gap:5 }}><span className="eyebrow">Email</span>
                <input className="field" style={{ height:44 }} type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={onKey(submitEmail)} /></label>
              <label className="stack" style={{ gap:5 }}><span className="eyebrow">Password</span>
                <div className="row" style={{ gap:8 }}>
                  <input className="field grow" style={{ height:44 }} type={show?'text':'password'} autoComplete={kind==='up'?'new-password':'current-password'} value={pw} onChange={e=>setPw(e.target.value)} placeholder={kind==='up'?'Choose a password (6+ characters)':'Your password'} onKeyDown={onKey(submitEmail)} />
                  <button className="btn btn-soft btn-icon" style={{ height:44, width:44, flex:'none' }} onClick={()=>setShow(s=>!s)} aria-label={show?'Hide password':'Show password'}><Icon name="eye" size={17} /></button>
                </div></label>
              {kind==='in' && <button className="linkbtn" style={{ fontSize:12, alignSelf:'flex-end', marginTop:-2 }} disabled={busy} onClick={forgot}>Forgot password?</button>}
              {err && <div className="row" style={{ gap:8, color:'var(--bad)', fontSize:13 }}><Icon name="x" size={14} />{err}</div>}
              {notice && <div className="row" style={{ gap:8, color:'var(--good)', fontSize:13 }}><Icon name="check" size={14} />{notice}</div>}
              <button className="btn btn-primary btn-lg" style={{ width:'100%' }} disabled={busy} onClick={submitEmail}>
                {busy ? 'One moment…' : kind==='up' ? <><Icon name="user" size={17} />Create my account</> : <><Icon name="arrowR" size={17} />Sign in</>}
              </button>
            </div>
          ) : (
            <div className="stack" style={{ gap:12 }}>
              <label className="stack" style={{ gap:5 }}><span className="eyebrow">Phone number</span>
                <input className="field" style={{ height:44 }} type="tel" autoComplete="tel" value={phone} onChange={e=>{ setPhone(e.target.value); setOtpSent(false); }} placeholder="+1 555 012 3456" onKeyDown={onKey(otpSent?verifyOtp:sendOtp)} /></label>
              {otpSent && (
                <label className="stack" style={{ gap:5 }}><span className="eyebrow">6-digit code</span>
                  <input className="field" style={{ height:44, letterSpacing:'.3em', fontWeight:700 }} inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} placeholder="••••••" onKeyDown={onKey(verifyOtp)} /></label>
              )}
              {err && <div className="row" style={{ gap:8, color:'var(--bad)', fontSize:13 }}><Icon name="x" size={14} />{err}</div>}
              {notice && <div className="row" style={{ gap:8, color:'var(--good)', fontSize:13 }}><Icon name="check" size={14} />{notice}</div>}
              {!otpSent ? (
                <button className="btn btn-primary btn-lg" style={{ width:'100%' }} disabled={busy} onClick={sendOtp}>{busy?'Sending…':<><Icon name="arrowR" size={17} />Text me a code</>}</button>
              ) : (
                <div className="stack" style={{ gap:8 }}>
                  <button className="btn btn-primary btn-lg" style={{ width:'100%' }} disabled={busy} onClick={verifyOtp}>{busy?'Verifying…':<><Icon name="check" size={17} />Verify & sign in</>}</button>
                  <button className="linkbtn" style={{ fontSize:12.5, alignSelf:'center' }} disabled={busy} onClick={sendOtp}>Resend code</button>
                </div>
              )}
            </div>
          )}

          <div className="hr" style={{ margin:'18px 0 12px' }} />
          <PrivacyChip text="Your account stores only what you choose to sync" />
          </>)}
        </div>

        <div className="center"><button className="linkbtn" style={{ fontSize:12.5 }} onClick={()=>go('landing')}><Icon name="chevL" size={13} /> Back to home</button></div>
      </div>
    </div>
  );
}

Object.assign(window, { Auth });

export { Auth };
