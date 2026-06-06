import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   KITHRA — system overlays: startup permissions + toast
   ============================================================ */
function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className="kt-toast" key={toast.id}>
      <span className="center" style={{ width:22, height:22, borderRadius:7, background:'var(--accent)', color:'var(--accent-ink)', flex:'none' }}><Icon name={toast.icon} size={13} stroke={2.6} /></span>
      <span style={{ fontSize:13.5, fontWeight:600 }}>{toast.msg}</span>
    </div>
  );
}

function PermissionGate() {
  const { perms, savePerms, route, showToast } = useApp();
  // only on first entry to an app screen, and only if never answered
  const isApp = ROUTES[route]?.app;
  const [status, setStatus] = React.useState({ mic:'idle', contacts:'idle', location:'idle' });
  const [busy, setBusy] = React.useState(null);

  if (perms || !isApp) return null;

  const reqMic = async () => {
    setBusy('mic');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      stream.getTracks().forEach(t=>t.stop());
      setStatus(s=>({ ...s, mic:'granted' }));
    } catch(e) { setStatus(s=>({ ...s, mic:'denied' })); }
    setBusy(null);
  };
  const reqContacts = async () => {
    setBusy('contacts');
    // Contacts Picker API is rare; simulate a grant either way
    await new Promise(r=>setTimeout(r,500));
    setStatus(s=>({ ...s, contacts:'granted' }));
    setBusy(null);
  };
  const reqLocation = () => {
    setBusy('location');
    if (!navigator.geolocation) { setStatus(s=>({ ...s, location:'denied' })); setBusy(null); return; }
    navigator.geolocation.getCurrentPosition(
      ()=>{ setStatus(s=>({ ...s, location:'granted' })); setBusy(null); },
      ()=>{ setStatus(s=>({ ...s, location:'skipped' })); setBusy(null); },
      { timeout:8000 }
    );
  };
  const finish = () => { savePerms({ ...status, at: Date.now() }); showToast('Permissions saved · you can change these in Privacy', 'shield'); };

  const items = [
    { k:'mic', icon:'mic', req:true, title:'Microphone', desc:'So Kithra can listen, transcribe, and capture your conversations. Required to record.', action:reqMic },
    { k:'contacts', icon:'user', req:false, title:'Contacts', desc:'To recognise who you speak with and tag recordings by person & relationship. Powers smart filtering.', action:reqContacts },
    { k:'location', icon:'target', req:false, title:'Location', desc:'Optional — adds where a conversation happened (home, office, on the move) for richer context.', action:reqLocation, optional:true },
  ];
  const micOk = status.mic==='granted';
  const stProps = (st) => st==='granted' ? {l:'Allowed',k:'good'} : st==='denied' ? {l:'Blocked',k:'bad'} : st==='skipped' ? {l:'Skipped',k:'neutral'} : null;

  return (
    <div className="kt-perm-overlay">
      <div className="kt-perm card">
        <div className="stack center" style={{ gap:12, textAlign:'center', marginBottom:6 }}>
          <LumenMark size={42} />
          <div className="stack" style={{ gap:5 }}>
            <h2 className="display" style={{ fontSize:24, margin:0 }}>Let’s set up Kithra</h2>
            <p className="muted" style={{ margin:0, fontSize:13.5, lineHeight:1.5, maxWidth:380 }}>
              A few permissions so Kithra can capture and understand your conversations. You’re always in control — change them anytime.
            </p>
          </div>
        </div>

        <div className="stack" style={{ gap:10, margin:'18px 0' }}>
          {items.map(it=>{
            const st = stProps(status[it.k]);
            return (
              <div key={it.k} className="kt-perm-row">
                <span className="center kt-perm-ic"><Icon name={it.icon} size={20} /></span>
                <div className="stack grow" style={{ gap:2, minWidth:0 }}>
                  <span className="row" style={{ gap:7 }}>
                    <span style={{ fontWeight:650, fontSize:14 }}>{it.title}</span>
                    {it.req ? <span className="badge badge-accent" style={{ height:19 }}>Required</span> : <span className="badge badge-neutral" style={{ height:19 }}>Optional</span>}
                  </span>
                  <span className="faint" style={{ fontSize:12, lineHeight:1.4 }}>{it.desc}</span>
                </div>
                {st
                  ? <span className={`badge badge-${st.k}`} style={{ flex:'none' }}>{st.l}</span>
                  : <button className="btn btn-soft btn-sm" style={{ flex:'none' }} disabled={busy===it.k} onClick={it.action}>{busy===it.k?'…':'Allow'}</button>}
              </div>
            );
          })}
        </div>

        <button className="btn btn-primary btn-lg" style={{ width:'100%', opacity:micOk?1:0.55 }} disabled={!micOk} onClick={finish}>
          {micOk ? 'Continue' : 'Allow microphone to continue'} {micOk && <Icon name="arrowR" size={18} />}
        </button>
        <button className="btn btn-ghost btn-sm" style={{ width:'100%', marginTop:8 }} onClick={()=>savePerms({ skipped:true, at:Date.now() })}>Maybe later</button>
        <div className="center" style={{ marginTop:12 }}><PrivacyChip text="Encrypted · used only inside your private workspace" /></div>
      </div>
    </div>
  );
}

Object.assign(window, { Toast, PermissionGate });


export { Toast, PermissionGate };
