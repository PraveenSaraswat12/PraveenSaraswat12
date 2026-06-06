import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import { LiveCaptureHost } from './screens-capture.jsx';
import { Toast, PermissionGate } from './screens-system.jsx';
/* ============================================================
   LUMEN — app shell, router, provider, tweaks
   ============================================================ */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "business",
  "theme": "light",
  "accent": "auto",
  "headlineFont": "newsreader",
  "radius": 16,
  "density": "comfortable",
  "heroVariant": "A"
}/*EDITMODE-END*/;

const FONT_MAP = {
  newsreader: "'Newsreader', Georgia, serif",
  schibsted:  "'Schibsted Grotesk', sans-serif",
  space:      "'Space Grotesk', sans-serif",
};

function AppProvider() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ----- routing -----
  const [route, setRoute] = React.useState(() => {
    const h = (location.hash || '').replace('#', '');
    return ROUTES[h] ? h : 'landing';
  });
  const [convoId, setConvoId] = React.useState(null);
  const go = React.useCallback((r, opts = {}) => {
    if (opts.convo) setConvoId(opts.convo);
    setRoute(r);
    try { location.hash = r; } catch (e) {}
    const sc = document.querySelector('.app-scroll'); if (sc) sc.scrollTop = 0;
  }, []);
  React.useEffect(() => {
    const onHash = () => { const h = (location.hash||'').replace('#',''); if (ROUTES[h]) setRoute(h); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // ----- flow state -----
  const [goals, setGoals] = React.useState([]);
  const [goalText, setGoalText] = React.useState('');
  const [files, setFiles] = React.useState(() => (window.LUMEN?.importQueue || []).slice());
  const [connections, setConnections] = React.useState({ google:false, teams:false, zoom:false, drive:false });
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [authNext, setAuthNext] = React.useState('onboarding');
  const [authMode, setAuthMode] = React.useState('signup');
  const [dashRange, setDashRange] = React.useState('30d');
  const [plan, setPlanState] = React.useState(() => { try { return localStorage.getItem('kithra_plan') || 'free'; } catch(e){ return 'free'; } });
  const setPlan = React.useCallback((p) => { setPlanState(p); try { localStorage.setItem('kithra_plan', p); } catch(e){} }, []);
  const planAllows = React.useCallback((tier) => ({free:0,plus:1,premium:2}[plan] ?? 0) >= ({free:0,plus:1,premium:2}[tier] ?? 0), [plan]);
  const plus = plan !== 'free';
  const setPlus = React.useCallback((v) => setPlan(v ? 'plus' : 'free'), [setPlan]);
  const [wiped, setWiped] = React.useState(false);
  const [toast, setToastState] = React.useState(null);
  const toastTimer = React.useRef(null);
  const showToast = React.useCallback((msg, icon='check') => {
    clearTimeout(toastTimer.current);
    setToastState({ msg, icon, id: Date.now() });
    toastTimer.current = setTimeout(() => setToastState(null), 2600);
  }, []);
  const [perms, setPerms] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('kithra_perms')) || null; } catch(e){ return null; }
  });
  const savePerms = React.useCallback((p) => {
    setPerms(p); try { localStorage.setItem('kithra_perms', JSON.stringify(p)); } catch(e){}
  }, []);

  // ----- voice prefs (shared by Ask + background capture) -----
  const [voicePrefs, setVoicePrefs] = React.useState({ lang:'auto', voice:'', voiceReply:true });
  const setVoice = React.useCallback((patch) => setVoicePrefs(p => ({ ...p, ...patch })), []);
  // ----- background capture controller -----
  const [capture, setCapture] = React.useState({ open:false, minimized:false, capMode:'listen' });
  const openCapture   = React.useCallback((capMode) => setCapture(c => ({ open:true, minimized:false, capMode: capMode || c.capMode })), []);
  const closeCapture  = React.useCallback(() => setCapture(c => ({ ...c, open:false, minimized:false })), []);
  const minimizeCapture = React.useCallback(() => setCapture(c => ({ ...c, minimized:true })), []);
  const expandCapture = React.useCallback(() => setCapture(c => ({ ...c, open:true, minimized:false })), []);
  const setCapMode = React.useCallback((capMode) => setCapture(c => ({ ...c, capMode })), []);

  const data = window.LUMEN?.[t.mode] || window.LUMEN?.business;
  const ctx = {
    t, setTweak, route, go, convoId,
    data, mode: t.mode,
    flow: { goals, setGoals, goalText, setGoalText, files, setFiles, connections, setConnections,
            authNext, setAuthNext, authMode, setAuthMode, dashRange, setDashRange },
    voicePrefs, setVoice,
    capture, openCapture, closeCapture, minimizeCapture, expandCapture, setCapMode,
    plus, setPlus, plan, setPlan, planAllows, wiped, setWiped, toast, showToast, perms, savePerms,
    sidebarCollapsed, setSidebarCollapsed,
  };

  // ----- apply tokens to root -----
  const rootStyle = {
    '--radius-base': `${t.radius}px`,
    '--density': t.density === 'compact' ? 0.82 : 1,
    '--font-display': FONT_MAP[t.headlineFont] || FONT_MAP.newsreader,
    height:'100%',
  };

  const isApp = ROUTES[route]?.app;

  return (
    <AppContext.Provider value={ctx}>
      <div id="lumen-root" data-theme={t.theme} data-mode={t.mode} data-accent={t.accent} style={rootStyle}>
        {isApp ? <AppShell /> : <FullScreen route={route} />}
        {window.LiveCaptureHost ? <LiveCaptureHost /> : null}
        {window.PermissionGate ? <PermissionGate /> : null}
        {window.Toast ? <Toast /> : null}
        <TweaksUI />
      </div>
    </AppContext.Provider>
  );
}

/* ---------- full-screen (non-app) routes ---------- */
function FullScreen({ route }) {
  const map = {
    landing: window.Landing,
    auth: window.Auth,
    onboarding: window.Onboarding,
    import: window.ImportSources,
    processing: window.Processing,
  };
  const Screen = map[route] || window.Landing;
  return Screen ? <Screen /> : <Placeholder name={route} />;
}

/* ---------- app shell ---------- */
function AppShell() {
  const { route } = useApp();
  const map = {
    dashboard: window.Dashboard,
    conversation: window.Conversation,
    ask: window.AskKithra,
    patterns: window.Patterns,
    library: window.Library,
    analyze: window.Analyze,
    sources: window.SourcesPanel,
    privacy: window.Privacy,
    pricing: window.Pricing,
  };
  const Screen = map[route] || window.Dashboard;
  return (
    <div className="app">
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <div className="app-scroll scroll">
          {Screen ? <Screen /> : <Placeholder name={route} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- sidebar ---------- */
function Sidebar() {
  const { route, go, sidebarCollapsed, setSidebarCollapsed, planAllows } = useApp();
  const groups = [
    { key:'main', label:'Workspace' },
    { key:'data', label:'Your data' },
  ];
  const NavItem = ({ id }) => {
    const r = ROUTES[id];
    const locked = id==='patterns' && !planAllows('plus');
    return (
      <a className={`nav-item ${route===id?'active':''}`} onClick={()=>go(id)} title={r.label}>
        <span className="ic"><Icon name={r.icon} size={19} /></span>
        <span className="lbl">{r.label}</span>
        {locked && <span className="lbl lock-pill" data-tier="plus" style={{ marginLeft:'auto' }}><Icon name="lock" size={9} />Plus</span>}
        {route===id && <span style={{ position:'absolute', left:0, top:9, bottom:9, width:3, borderRadius:3, background:'var(--accent)' }} />}
      </a>
    );
  };
  return (
    <aside className={`side ${sidebarCollapsed?'collapsed':''}`}>
      <div className="side-brand">
        <LumenMark size={32} />
        <span className="wordmark" style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:600, letterSpacing:'-.02em' }}>Kithra</span>
      </div>
      {groups.map(g => (
        <div className="nav-group" key={g.key}>
          <div className="nav-label">{g.label}</div>
          {Object.keys(ROUTES).filter(id => ROUTES[id].app && ROUTES[id].group===g.key).map(id => <NavItem key={id} id={id} />)}
        </div>
      ))}
      <div className="grow" />
      <div className="nav-group">
        <a className="nav-item" onClick={()=>setSidebarCollapsed(c=>!c)} title="Collapse">
          <span className="ic"><Icon name={sidebarCollapsed?'chevR':'chevL'} size={19} /></span>
          <span className="lbl">Collapse</span>
        </a>
        <a className="nav-item" onClick={()=>go('landing')} title="Sign out">
          <span className="ic"><Icon name="home" size={19} /></span>
          <span className="lbl">Home</span>
        </a>
      </div>
      <div className="side-card card" style={{ padding:12, marginTop:6, background:'var(--surface-2)' }}>
        <PrivacyChip text="Private workspace" />
        <span className="faint" style={{ fontSize:11.5, display:'block', marginTop:6, lineHeight:1.4 }}>Encrypted & never used to train shared models.</span>
      </div>
    </aside>
  );
}

/* ---------- topbar ---------- */
function Topbar() {
  const { route, t, setTweak, go } = useApp();
  const title = ROUTES[route]?.label || '';
  return (
    <header className="topbar">
      <h2 className="pt">{title}</h2>
      <div className="grow" />
      <div className="searchbox click" style={{ width:230, maxWidth:'26vw' }} onClick={()=>go('ask')}>
        <Icon name="search" size={17} />
        <span style={{ fontSize:13.5 }}>Ask across your data…</span>
        <span className="kbd" style={{ marginLeft:'auto' }}>⌘K</span>
      </div>
      <ModeSwitch />
      <PlanPill />
      <button className="btn btn-icon btn-ghost" onClick={()=>setTweak('theme', t.theme==='dark'?'light':'dark')} aria-label="Toggle theme">
        <Icon name={t.theme==='dark'?'sun':'moon'} size={18} />
      </button>
      <AccountMenu />
    </header>
  );
}

/* ---------- account menu ---------- */
function AccountMenu() {
  const { go, plan, mode, showToast } = useApp();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const items = [
    { ic:'user', label:'Profile', act:()=>showToast('Profile — coming soon','user') },
    { ic:'spark', label:'Plans & billing', act:()=>go('pricing') },
    { ic:'layers', label:'My recordings', act:()=>go('library') },
    { ic:'shield', label:'Privacy & data', act:()=>go('privacy') },
  ];
  return (
    <div className="dd" ref={ref}>
      <button onClick={()=>setOpen(o=>!o)} style={{ border:0, background:'transparent', padding:0, cursor:'pointer', borderRadius:'50%' }} aria-label="Account">
        <Avatar label="DR" color="var(--viz-1)" size={36} />
      </button>
      {open && (
        <div className="dd-menu" style={{ minWidth:230, right:0, left:'auto' }}>
          <div className="row" style={{ gap:10, padding:'8px 10px 10px' }}>
            <Avatar label="DR" color="var(--viz-1)" size={34} />
            <div className="stack" style={{ gap:1, minWidth:0 }}>
              <span style={{ fontWeight:700, fontSize:13.5 }}>Dana Rivera</span>
              <span className="faint tcap" style={{ fontSize:11.5 }}>{plan} plan · {mode}</span>
            </div>
          </div>
          <div className="hr" style={{ margin:'2px 0 5px' }} />
          {items.map((it,i)=>(
            <button key={i} className="dd-item" onClick={()=>{ setOpen(false); it.act(); }}><Icon name={it.ic} size={16} /><span className="grow" style={{ textAlign:'left' }}>{it.label}</span></button>
          ))}
          <div className="hr" style={{ margin:'5px 0' }} />
          <button className="dd-item" onClick={()=>{ setOpen(false); go('landing'); }}><Icon name="home" size={16} /><span className="grow" style={{ textAlign:'left' }}>Sign out</span></button>
        </div>
      )}
    </div>
  );
}

/* ---------- plan pill (top-bar plan switcher) ---------- */
function PlanPill() {
  const { plan, setPlan, go, showToast } = useApp();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const PLANS = [
    { k:'free', label:'Free', sub:'Capture + Date & Length filters', color:'var(--ink-3)' },
    { k:'plus', label:'Plus', sub:'AI categories, topics & tone', color:'var(--accent)' },
    { k:'premium', label:'Premium', sub:'People, relationships & teams', color:'var(--viz-5)' },
  ];
  const cur = PLANS.find(p => p.k === plan) || PLANS[0];
  return (
    <div className="dd" ref={ref}>
      <button className={`plan-pill ${plan}`} onClick={()=>setOpen(o=>!o)} aria-expanded={open} title="Your plan">
        <Icon name={plan==='free'?'spark':'spark'} size={14} fill={plan!=='free'} />
        <span>{cur.label}</span>
        <Icon name="chevD" size={13} style={{ transform: open?'rotate(180deg)':'none', transition:'transform .18s' }} />
      </button>
      {open && (
        <div className="dd-menu" style={{ minWidth:248, right:0, left:'auto' }}>
          <div className="faint" style={{ fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', padding:'6px 10px 4px' }}>Your plan</div>
          {PLANS.map(p => (
            <button key={p.k} className={`dd-item ${p.k===plan?'on':''}`} style={{ height:'auto', padding:'9px 11px', alignItems:'flex-start' }}
              onClick={()=>{ setPlan(p.k); setOpen(false); showToast(p.k==='free'?'Switched to Free':`${p.label} active — features unlocked`, p.k==='free'?'check':'spark'); }}>
              <span className="center" style={{ width:24, height:24, borderRadius:7, background:`color-mix(in srgb,${p.color} 16%, transparent)`, color:p.color, flex:'none', marginTop:1 }}><Icon name="spark" size={13} fill={p.k!=='free'} /></span>
              <span className="stack grow" style={{ gap:1, minWidth:0 }}>
                <span style={{ fontWeight:700, fontSize:13.5 }}>{p.label}</span>
                <span className="faint" style={{ fontSize:11.5, lineHeight:1.3 }}>{p.sub}</span>
              </span>
              {p.k===plan && <Icon name="check" size={15} stroke={2.6} style={{ marginTop:3 }} />}
            </button>
          ))}
          <div className="hr" style={{ margin:'5px 0' }} />
          <button className="dd-item" onClick={()=>{ setOpen(false); go('pricing'); }}><Icon name="arrowR" size={15} /><span className="grow" style={{ textAlign:'left' }}>Compare plans</span></button>
        </div>
      )}
    </div>
  );
}

/* ---------- mode switch ---------- */
function ModeSwitch() {
  const { t, setTweak } = useApp();
  const modes = [{ k:'business', l:'Business', ic:'briefcase' }, { k:'personal', l:'Personal', ic:'heart' }];
  const idx = t.mode === 'personal' ? 1 : 0;
  return (
    <div className="modeswitch" role="tablist" aria-label="Mode">
      <span className="thumb" style={{ left:`calc(4px + ${idx} * 50%)`, width:'calc(50% - 4px)' }} />
      {modes.map(m => (
        <button key={m.k} className={t.mode===m.k?'on':''} onClick={()=>setTweak('mode', m.k)} role="tab" aria-selected={t.mode===m.k}>
          <Icon name={m.ic} size={15} />{m.l}
        </button>
      ))}
    </div>
  );
}

/* ---------- tweaks panel ---------- */
function TweaksUI() {
  const { t, setTweak } = useApp();
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Product">
        <TweakRadio label="Mode" value={t.mode} options={[{value:'business',label:'Business'},{value:'personal',label:'Personal'}]} onChange={v=>setTweak('mode',v)} />
        <TweakRadio label="Theme" value={t.theme} options={[{value:'light',label:'Light'},{value:'dark',label:'Dark'}]} onChange={v=>setTweak('theme',v)} />
      </TweakSection>
      <TweakSection label="Brand">
        <TweakColor label="Accent" value={t.accent}
          options={['auto','blue','coral','teal','violet','amber']}
          onChange={v=>setTweak('accent',v)} />
        <AccentSwatches t={t} setTweak={setTweak} />
        <TweakSelect label="Headline font" value={t.headlineFont}
          options={[{value:'newsreader',label:'Newsreader (serif)'},{value:'schibsted',label:'Schibsted (sans)'},{value:'space',label:'Space Grotesk'}]}
          onChange={v=>setTweak('headlineFont',v)} />
      </TweakSection>
      <TweakSection label="Form">
        <TweakSlider label="Corner radius" value={t.radius} min={4} max={24} unit="px" onChange={v=>setTweak('radius',v)} />
        <TweakRadio label="Density" value={t.density} options={[{value:'comfortable',label:'Comfortable'},{value:'compact',label:'Compact'}]} onChange={v=>setTweak('density',v)} />
      </TweakSection>
      <TweakSection label="Landing">
        <TweakRadio label="Hero layout" value={t.heroVariant} options={[{value:'A',label:'Centered'},{value:'B',label:'Split'}]} onChange={v=>setTweak('heroVariant',v)} />
      </TweakSection>
    </TweaksPanel>
  );
}
// custom accent swatch row (since TweakColor options are strings -> show real colors)
function AccentSwatches({ t, setTweak }) {
  const opts = [
    { k:'auto', c:'linear-gradient(135deg,#3a6df4,#f5734f)' },
    { k:'blue', c:'#3a6df4' }, { k:'coral', c:'#f5734f' },
    { k:'teal', c:'#15a394' }, { k:'violet', c:'#7a5af0' }, { k:'amber', c:'#e0922f' },
  ];
  return (
    <div className="twk-chips" style={{ marginTop:-4 }}>
      {opts.map(o => (
        <button key={o.k} type="button" className="twk-chip" data-on={t.accent===o.k?'1':'0'}
          style={{ background:o.c }} onClick={()=>setTweak('accent', o.k)} title={o.k} aria-label={o.k} />
      ))}
    </div>
  );
}

/* ---------- placeholder ---------- */
function Placeholder({ name }) {
  return (
    <div className="page center" style={{ minHeight:'60vh' }}>
      <div className="stack center" style={{ gap:10 }}>
        <Icon name="wave" size={28} />
        <span className="muted">Screen “{name}” coming up…</span>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppProvider />);

Object.assign(window, { AppProvider });


export { AppProvider };
