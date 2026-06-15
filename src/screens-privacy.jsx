import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import { Panel } from './screens-dashboard.jsx';
/* ============================================================
   LUMEN — Privacy & Data Controls
   ============================================================ */
function Toggle({ on, onClick }) {
  return <button className={`toggle ${on?'on':''}`} onClick={onClick} role="switch" aria-checked={on}><i /></button>;
}

function HowProtected() {
  return (
    <Panel title="How Kithra protects your data" sub="Plain answers — this is the heart of the product">
      <div className="grid g-2" style={{ gap:12 }}>
        {[
          ['mic','Analyzed on your device','Recording analysis (pace, pauses, energy, waveform) runs in your browser/app. By default, audio never leaves your device.'],
          ['shield','Nothing moves without consent','Cloud transcription and AI insights each require an explicit, recorded consent — purpose-by-purpose, withdrawable in one click below.'],
          ['lock','Encrypted before upload','Anything you sync (transcripts, book notes) is encrypted on your device with AES-GCM-256 before it reaches our database; rows are isolated per-user.'],
          ['eye','Redacted before AI','With redaction on, emails, phone numbers and long digits are masked in transcripts before display, storage, or any AI call.'],
          ['spark','Never trains models','Your content is never sold and never used to train shared models. The AI key lives server-side — it never ships in the app.'],
          ['trash','Erasable in one click','“Delete all my data” wipes this device and your cloud rows immediately. Export everything as JSON anytime.'],
        ].map((x,i)=>(
          <div key={i} className="row" style={{ gap:11, alignItems:'flex-start', padding:'12px 13px', borderRadius:'var(--r-ctrl)', background:'var(--surface-2)', border:'1px solid var(--line)' }}>
            <span className="center" style={{ width:34, height:34, borderRadius:10, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none' }}><Icon name={x[0]} size={17} /></span>
            <div className="stack" style={{ gap:2, minWidth:0 }}>
              <span style={{ fontWeight:650, fontSize:13.5 }}>{x[1]}</span>
              <span className="faint" style={{ fontSize:12.5, lineHeight:1.5 }}>{x[2]}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CloudAccount() {
  const { showToast, books } = useApp();
  const Cloud = window.KithraCloud;
  const [cfg, setCfg] = React.useState(() => (Cloud && Cloud.config && Cloud.config()) || null);
  const [url, setUrl] = React.useState(cfg?.SUPABASE_URL || '');
  const [key, setKey] = React.useState(cfg?.SUPABASE_ANON_KEY || '');
  const [user, setUser] = React.useState(null);
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const connected = !!cfg;
  React.useEffect(() => { let on = true; (async () => { if (Cloud && Cloud.configured && Cloud.configured()) { const u = await Cloud.getUser(); if (on) setUser(u); } })(); return () => { on = false; }; }, [cfg]);
  if (!Cloud) return null;
  const connect = () => { if (!url.trim() || !key.trim()) { setErr('Paste your Project URL and anon key.'); return; } Cloud.saveConfig(url, key); setCfg(Cloud.config()); setErr(''); showToast('Cloud connected', 'link'); };
  const disconnect = () => { Cloud.clearConfig(); setCfg(null); setUser(null); showToast('Cloud disconnected', 'check'); };
  const auth = async (kind) => {
    setBusy(true); setErr('');
    try { await (kind === 'up' ? Cloud.signUp : Cloud.signIn)(email.trim(), pw); const u = await Cloud.getUser(); setUser(u); if (u) { Cloud.syncBooks(books); showToast(kind === 'up' ? 'Account created' : 'Signed in', 'check'); } else showToast('Check your email to confirm', 'check'); }
    catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const signOut = async () => { await Cloud.signOut(); setUser(null); showToast('Signed out', 'check'); };
  return (
    <Panel title="Cloud & account" sub="Optional — sync across devices + Kithra AI, on your own free Supabase">
      {!connected ? (
        <div className="stack" style={{ gap: 12 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>Kithra works on this device with no account. To sync your books &amp; recordings and turn on Kithra AI, connect a free Supabase project (5-minute setup in <code>cloud/README.md</code>).</p>
          <label className="stack" style={{ gap: 5 }}><span className="eyebrow">Supabase Project URL</span><input className="field" style={{ height: 40 }} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></label>
          <label className="stack" style={{ gap: 5 }}><span className="eyebrow">anon public key</span><input className="field" style={{ height: 40 }} value={key} onChange={e => setKey(e.target.value)} placeholder="eyJhbGciOi…" /></label>
          {err && <span style={{ color: 'var(--bad)', fontSize: 12.5 }}>{err}</span>}
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={connect}><Icon name="link" size={15} />Connect cloud</button>
        </div>
      ) : user ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 11 }}>
            <Avatar label={(user.email || 'U')[0].toUpperCase()} color="var(--accent)" size={40} />
            <div className="stack" style={{ gap: 1, minWidth: 0 }}><span style={{ fontWeight: 700, fontSize: 14 }}>{user.email}</span><span className="faint" style={{ fontSize: 12 }}>Signed in · your library syncs to the cloud</span></div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-soft btn-sm" onClick={() => { Cloud.syncBooks(books); showToast('Library synced', 'check'); }}><Icon name="refresh" size={14} />Sync now</button>
            <button className="btn btn-soft btn-sm" onClick={signOut}>Sign out</button>
            <button className="btn btn-ghost btn-sm" onClick={disconnect}>Disconnect</button>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><Badge kind="good" dot>Cloud connected</Badge><button className="btn btn-ghost btn-sm" onClick={disconnect}>Change project</button></div>
          <label className="stack" style={{ gap: 5 }}><span className="eyebrow">Email</span><input className="field" style={{ height: 40 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label className="stack" style={{ gap: 5 }}><span className="eyebrow">Password</span><input className="field" style={{ height: 40 }} type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" /></label>
          {err && <span style={{ color: 'var(--bad)', fontSize: 12.5 }}>{err}</span>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => auth('up')}>{busy ? '…' : 'Create account'}</button>
            <button className="btn btn-soft btn-sm" disabled={busy} onClick={() => auth('in')}>Sign in</button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ---------- consent ledger + data rights (export / erase) ---------- */
const PURPOSES = [
  { k:'cloud_transcription', label:'Cloud transcription', desc:'Send a selected audio clip to the cloud for accurate speech-to-text.' },
  { k:'cloud_ai', label:'Cloud AI insights', desc:'Send transcript text to the cloud to generate coaching insights.' },
  { k:'cloud_sync', label:'Account sync', desc:'Store your books & recording metadata in your account.' },
];
function ConsentDataPanel() {
  const { consents, grantConsent, withdrawConsent, books, clips, plan, showToast } = useApp();
  const [confirmDel, setConfirmDel] = React.useState(false);
  const fmtAt = (t) => t ? new Date(t).toLocaleString(undefined, { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
  const exportData = () => {
    const data = {
      exportedAt: new Date().toISOString(), app: 'Kithra', plan,
      consents,
      books,
      recordings: (clips||[]).map(c => ({ id:c.id, name:c.name, durSec:c.durSec, source:c.source, analysis:c.analysis })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kithra-data-export.json';
    document.body.appendChild(a); a.click(); a.remove();
    showToast('Your data export is downloading', 'download');
  };
  const deleteEverything = async () => {
    try { if (window.KithraCloud && window.KithraCloud.configured()) await window.KithraCloud.deleteAllCloud(); } catch(e){}
    try {
      const keep = ['kithra_plan'];
      Object.keys(localStorage).filter(k => k.indexOf('kithra_') === 0 && keep.indexOf(k) < 0).forEach(k => localStorage.removeItem(k));
    } catch(e){}
    location.reload(); // restart clean — local state, clips, consents all gone
  };
  return (
    <Panel title="Consent & your data rights" sub="Purpose-by-purpose consent — documented, withdrawable, no dark patterns">
      <div className="stack" style={{ gap:10 }}>
        {PURPOSES.map(p => {
          const c = consents && consents[p.k];
          const on = !!(c && c.granted);
          return (
            <div key={p.k} className="pv-row">
              <span className="center" style={{ width:42, height:42, borderRadius:12, background: on ? 'var(--good-soft)' : 'var(--surface-2)', border:'1px solid var(--line)', color: on ? 'var(--good)' : 'var(--ink-3)', flex:'none' }}><Icon name={on?'check':'lock'} size={19} /></span>
              <div className="stack grow" style={{ gap:2, minWidth:0 }}>
                <span className="row" style={{ gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontWeight:650, fontSize:14 }}>{p.label}</span>
                  {c ? <span className={`badge ${on?'badge-good':'badge-neutral'}`} style={{ height:19 }}>{on?'Granted':'Withdrawn'} · {fmtAt(c.at)}</span> : <span className="badge badge-neutral" style={{ height:19 }}>Never asked</span>}
                </span>
                <span className="muted" style={{ fontSize:12.5, lineHeight:1.45 }}>{p.desc}</span>
              </div>
              {on
                ? <button className="btn btn-soft btn-sm" style={{ flex:'none' }} onClick={()=>{ withdrawConsent(p.k); showToast(`Consent withdrawn — ${p.label}`, 'shield'); }}>Withdraw</button>
                : <button className="btn btn-ghost btn-sm" style={{ flex:'none' }} onClick={()=>{ grantConsent(p.k); showToast(`Consent granted — ${p.label}`, 'check'); }}>Allow</button>}
            </div>
          );
        })}
      </div>
      <div className="hr" style={{ margin:'14px 0' }} />
      <div className="row" style={{ gap:8, flexWrap:'wrap' }}>
        <button className="btn btn-soft btn-sm" onClick={exportData}><Icon name="download" size={14} />Export my data (JSON)</button>
        {!confirmDel
          ? <button className="btn btn-soft btn-sm" style={{ color:'var(--bad)' }} onClick={()=>setConfirmDel(true)}><Icon name="trash" size={14} />Delete all my data</button>
          : <span className="row" style={{ gap:8, flexWrap:'wrap' }}>
              <span style={{ fontSize:12.5, color:'var(--bad)', fontWeight:600 }}>This erases everything on this device and in your cloud account. Sure?</span>
              <button className="btn btn-sm" style={{ background:'var(--bad)', color:'#fff' }} onClick={deleteEverything}>Yes, delete everything</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setConfirmDel(false)}>Cancel</button>
            </span>}
      </div>
    </Panel>
  );
}

function Privacy() {
  const { mode, showToast, setWiped, go, plan, planAllows, redact, setRedact } = useApp();
  const [delOpen, setDelOpen] = React.useState(false);
  const [expOpen, setExpOpen] = React.useState(false);
  const DeleteModal = window.DeleteModal;
  const ExportModal = window.ExportModal;
  const retCap = plan==='premium' ? 'Unlimited' : plan==='plus' ? '180 days' : '60 days';
  const [s, setS] = React.useState({ encrypt:true, training:false, team:mode==='business', autoDelete:false, redact:true, backup:true });
  const [retain, setRetain] = React.useState('60');
  const [backupEvery, setBackupEvery] = React.useState('15');
  const set = (k) => setS(p => ({ ...p, [k]: !p[k] }));

  const Setting = ({ icon, title, desc, k, locked }) => (
    <div className="pv-row">
      <span className="center" style={{ width:42, height:42, borderRadius:12, background:'var(--surface-2)', border:'1px solid var(--line)', color:'var(--ink-2)', flex:'none' }}><Icon name={icon} size={20} /></span>
      <div className="stack grow" style={{ gap:2, minWidth:0 }}>
        <span className="row" style={{ gap:8 }}><span style={{ fontWeight:650, fontSize:14.5 }}>{title}</span>{locked && <span className="badge badge-neutral"><Icon name="lock" size={11} />Always on</span>}</span>
        <span className="muted" style={{ fontSize:13, lineHeight:1.45 }}>{desc}</span>
      </div>
      {locked ? <span className="center" style={{ width:42, height:27 }}><Icon name="check" size={18} stroke={2.4} style={{ color:'var(--good)' }} /></span> : <Toggle on={s[k]} onClick={()=>set(k)} />}
    </div>
  );

  return (
    <div className="page">
      <div className="stack" style={{ gap:6, marginBottom:22 }}>
        <span className="eyebrow">Your data</span>
        <h1 className="display" style={{ fontSize:28, margin:0, whiteSpace:'nowrap' }}>Privacy & data controls</h1>
      </div>

      <div className="pv-layout">
        {/* promise hero */}
        <div className="card card-pad" style={{ background:'var(--accent-soft)', border:'1px solid color-mix(in srgb,var(--accent) 20%,transparent)', display:'flex', gap:18, alignItems:'center', flexWrap:'wrap' }}>
          <span className="center" style={{ width:56, height:56, borderRadius:16, background:'var(--accent)', color:'var(--accent-ink)', flex:'none' }}><Icon name="shield" size={28} /></span>
          <div className="stack grow" style={{ gap:4, minWidth:200 }}>
            <h3 className="display" style={{ fontSize:22, margin:0 }}>Your conversations are yours</h3>
            <p className="muted" style={{ margin:0, fontSize:14, lineHeight:1.5 }}>Encrypted end-to-end, never sold, and never used to train shared models. You can export or delete everything at any time.</p>
          </div>
          <div className="row" style={{ gap:18 }}>
            {[['lock','Encrypted'],['eye','Private'],['trash','Deletable']].map((x,i)=>(
              <div key={i} className="stack center" style={{ gap:6 }}><span className="center" style={{ width:40, height:40, borderRadius:12, background:'var(--surface)', color:'var(--accent-strong)' }}><Icon name={x[0]} size={19} /></span><span className="faint" style={{ fontSize:11.5, fontWeight:600 }}>{x[1]}</span></div>
            ))}
          </div>
        </div>

        <HowProtected />

        <CloudAccount />

        <ConsentDataPanel />

        {/* controls */}
        <Panel title="Privacy" sub="Decide how Kithra handles your recordings">
          <Setting icon="lock" title="End-to-end encryption" desc="Audio and transcripts are encrypted in transit and at rest." locked />
          <div className="pv-row">
            <span className="center" style={{ width:42, height:42, borderRadius:12, background:'var(--surface-2)', border:'1px solid var(--line)', color:'var(--ink-2)', flex:'none' }}><Icon name="eye" size={20} /></span>
            <div className="stack grow" style={{ gap:2, minWidth:0 }}>
              <span style={{ fontWeight:650, fontSize:14.5 }}>Redact names & numbers</span>
              <span className="muted" style={{ fontSize:13, lineHeight:1.45 }}>Really masks emails, phone numbers and long digits in transcripts before display or storage.</span>
            </div>
            <Toggle on={redact} onClick={()=>setRedact(!redact)} />
          </div>
          <Setting icon="spark" title="Use my data to improve Kithra" desc="When off, your conversations are never used to train any model. Off by default." k="training" />
          {mode==='business' && <Setting icon="user" title="Share insights with my team" desc="Let teammates on your workspace see aggregated patterns (never raw audio)." k="team" />}
        </Panel>

        <Panel title="Data retention" sub="How long Kithra keeps your recordings">
          <div className="row" style={{ gap:10, flexWrap:'wrap', alignItems:'center' }}>
            <span className="badge badge-accent" style={{ height:26 }}><Icon name="clock" size={12} />Your plan: {retCap}</span>
            <span className="faint" style={{ fontSize:12.5 }}>Free 60 days · Plus 180 days · Premium unlimited</span>
          </div>
          <div className="seg-radio" style={{ margin:'12px 0 6px' }}>
            {[['60','60 days','free'],['180','180 days','plus'],['forever','Unlimited','premium']].map(o=>{
              const ok = planAllows(o[2]); const on = retain===o[0];
              return <button key={o[0]} className={`chip ${on?'is-on':''} ${ok?'':'gated'}`} onClick={()=> ok ? setRetain(o[0]) : (showToast(`${o[1]} retention needs ${o[2]==='premium'?'Premium':'Plus'}`,'spark'), go('pricing')) }>{o[1]}{!ok && <span className="lock-pill"><Icon name="lock" size={9} />{o[2]==='premium'?'Premium':'Plus'}</span>}</button>;
            })}
          </div>
          <p className="faint" style={{ fontSize:12.5, margin:'10px 0 0', lineHeight:1.5 }}>
            {retain==='forever' ? 'Recordings are kept until you remove them. You\u2019re always in control.' : `Recordings and transcripts are automatically deleted after ${retain} days.`}
          </p>
        </Panel>

        <Panel title="Live capture & backup" sub="What happens while Listen mode is on">
          <div className="card card-pad" style={{ background:'var(--accent-soft)', border:'1px solid color-mix(in srgb,var(--accent) 18%,transparent)', display:'flex', gap:13, alignItems:'center', marginBottom:14 }}>
            <span className="center" style={{ width:42, height:42, borderRadius:12, background:'var(--accent)', color:'var(--accent-ink)', flex:'none' }}><Icon name="refresh" size={21} /></span>
            <div className="stack grow" style={{ gap:2 }}>
              <span style={{ fontWeight:700, fontSize:14 }}>Auto-backup every 15 minutes</span>
              <span className="muted" style={{ fontSize:12.5, lineHeight:1.45 }}>While Listen mode runs, Kithra chunks your audio and saves it to encrypted cloud storage every 15 min, so nothing is ever lost — memory is what makes the analysis good.</span>
            </div>
          </div>
          <Setting icon="refresh" title="Continuous cloud backup" desc="Keep saving captured audio in the background every 15 minutes." k="backup" />
          <Setting icon="mic" title="Listen mode is free, forever" desc="Capturing and storing your audio never costs anything. Insights are the paid part." locked />
          <div className="seg-radio" style={{ marginTop:14 }}>
            <span className="faint" style={{ fontSize:12, alignSelf:'center', marginRight:4 }}>Backup interval</span>
            {[['5','5 min'],['15','15 min'],['30','30 min']].map(o=>(
              <button key={o[0]} className={`chip ${backupEvery===o[0]?'is-on':''}`} onClick={()=>setBackupEvery(o[0])}>{o[1]}</button>
            ))}
          </div>
        </Panel>

        <Panel title="Import sources" sub="Optional — live capture is your main source">
          {[['Google Drive','drive','#16a765',true]].map((c,i)=>(
            <div key={i} className="pv-row">
              <span className="int-logo" style={{ background:c[2], width:40, height:40 }}><Icon name={c[1]} size={20} /></span>
              <div className="stack grow" style={{ gap:2 }}><span style={{ fontWeight:650, fontSize:14 }}>{c[0]}</span><span className="faint" style={{ fontSize:12.5 }}>{c[3]?'Connected · read-only access':'Not connected'}</span></div>
              <button className={`btn btn-sm ${c[3]?'btn-ghost':'btn-soft'}`} onClick={()=>showToast(c[3]?`${c[0]} disconnected`:`Connecting ${c[0]}…`, c[3]?'x':'link')}>{c[3]?'Disconnect':'Connect'}</button>
            </div>
          ))}
        </Panel>

        <Panel title="Export & delete" sub="Download transcripts (Plus) or full PDF exports (Premium)">
          <div className="row" style={{ gap:12, flexWrap:'wrap' }}>
            <button className="btn btn-soft" onClick={()=> planAllows('premium') ? setExpOpen(true) : (showToast('PDF export is a Premium feature','spark'), go('pricing')) }>
              <Icon name="download" size={16} />Export as PDF{!planAllows('premium') && <span className="lock-pill" style={{ marginLeft:2 }}><Icon name="lock" size={9} />Premium</span>}
            </button>
            <button className="btn btn-soft" onClick={()=> planAllows('plus') ? showToast('Downloading transcripts (.zip)…','file') : (showToast('Transcript download is a Plus feature','spark'), go('pricing')) }>
              <Icon name="file" size={16} />Download transcripts{!planAllows('plus') && <span className="lock-pill" style={{ marginLeft:2 }}><Icon name="lock" size={9} />Plus</span>}
            </button>
          </div>
          <div className="card card-pad" style={{ marginTop:16, background:'var(--bad-soft)', border:'1px solid color-mix(in srgb,var(--bad) 24%,transparent)' }}>
            <div className="row" style={{ gap:14, flexWrap:'wrap', justifyContent:'space-between' }}>
              <div className="row" style={{ gap:13 }}>
                <span className="center" style={{ width:42, height:42, borderRadius:12, background:'var(--surface)', color:'var(--bad)', flex:'none' }}><Icon name="trash" size={20} /></span>
                <div className="stack" style={{ gap:2 }}><span style={{ fontWeight:700, fontSize:14.5 }}>Delete all my data</span><span className="muted" style={{ fontSize:13 }}>Permanently removes every recording, transcript, and insight. Can\u2019t be undone.</span></div>
              </div>
              <button className="btn" style={{ background:'var(--bad)', color:'#fff' }} onClick={()=>setDelOpen(true)}>Delete by date…</button>
            </div>
          </div>
        </Panel>
      </div>
      {delOpen && <DeleteModal onClose={()=>setDelOpen(false)} onConfirm={(label)=>{ setDelOpen(false); setWiped(true); showToast(`Deleted recordings — ${label}`, 'trash'); go('library'); }} />}
      {expOpen && <ExportModal onClose={()=>setExpOpen(false)} onConfirm={(label)=>{ setExpOpen(false); showToast(`Exporting PDF — ${label}`, 'download'); }} />}
    </div>
  );
}

Object.assign(window, { Privacy });


export { Privacy };
