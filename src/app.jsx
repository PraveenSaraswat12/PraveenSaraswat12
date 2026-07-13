import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import { LiveCaptureHost } from './screens-capture.jsx';
import { Toast, PermissionGate } from './screens-system.jsx';
import { MobileHeader, MobileTabBar, useIsMobile } from './mobile-nav.jsx';
import * as ClipStore from './store.js';
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

// route aliases so friendly URLs resolve instead of falling back (e.g. #plans → pricing)
const ROUTE_ALIASES = { plans: 'pricing', billing: 'pricing', recordings: 'library', settings: 'privacy', terms: 'legal', help: 'legal', policy: 'legal' };
function resolveRoute(r) { return ROUTE_ALIASES[r] || r; }

function AppProvider() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ----- routing -----
  const [route, setRoute] = React.useState(() => {
    const h = resolveRoute((location.hash || '').replace('#', ''));
    return ROUTES[h] ? h : 'landing';
  });
  const [convoId, setConvoId] = React.useState(null);
  const [convoFrom, setConvoFrom] = React.useState('dashboard'); // where a deep-dive was opened from
  const [viewConvo, setViewConvo] = React.useState(null);        // the recording being viewed
  const go = React.useCallback((r, opts = {}) => {
    r = resolveRoute(r);
    if (opts.convo) setConvoId(opts.convo);
    if (opts.from) setConvoFrom(opts.from);
    if (opts.rec !== undefined) setViewConvo(opts.rec);
    if (opts.ask !== undefined) setAskFocus(opts.ask);
    setRoute(r);
    try { location.hash = r; } catch (e) {}
    const sc = document.querySelector('.app-scroll'); if (sc) sc.scrollTop = 0;
  }, []);
  React.useEffect(() => {
    const onHash = () => { const h = resolveRoute((location.hash||'').replace('#','')); if (ROUTES[h]) setRoute(h); };
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
  const setPlus = React.useCallback((v) => setPlan(v ? 'plus' : 'free'), [setPlan]);
  // NOTE: `plus`, `planAllows` and `effectivePlan` are owner-aware and defined
  // below, once the signed-in `user` is known (see "owner all-access").
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

  // ----- user's real recordings/uploads — durable across reload/logout/login -----
  // Stored local-first in IndexedDB (audio + metadata) so nothing is lost when the
  // tab reloads or the user signs out and back in; cloud sync mirrors it for
  // cross-device. `ownerRef` tags each recording to the signed-in account.
  const ownerRef = React.useRef('local');
  const [clips, setClips] = React.useState([]);
  const [viewClip, setViewClip] = React.useState(null); // clip whose insights to open on Analyze
  const addClip = React.useCallback((clip, blob) => {
    setClips(cs => [clip, ...cs.filter(c => c.id !== clip.id)].slice(0, 50));
    const owner = ownerRef.current;
    (async () => {
      let b = blob;
      // recover the blob from the object URL if a caller didn't hand us one
      if (!b && clip && clip.url) { try { b = await fetch(clip.url).then(r => r.blob()); } catch (e) {} }
      try { await ClipStore.putClip(clip, b, owner); await ClipStore.pruneClips(owner); } catch (e) {}
    })();
    try { if (window.KithraCloud && window.KithraCloud.configured()) window.KithraCloud.saveRecording(clip); } catch (e) {}
  }, []);
  const removeClip = React.useCallback((id) => {
    setClips(cs => {
      const gone = cs.find(c => c.id === id);
      if (gone && gone.url) { try { URL.revokeObjectURL(gone.url); } catch(e){} }
      return cs.filter(c => c.id !== id);
    });
    try { ClipStore.deleteClip(id); } catch (e) {}
    // also remove from the cloud, so a deleted recording doesn't reappear on re-login
    try { window.KithraCloud && window.KithraCloud.configured() && window.KithraCloud.deleteRecording && window.KithraCloud.deleteRecording(id); } catch (e) {}
  }, []);

  // ----- books library (knowledge base that grounds insights) — persisted on-device -----
  const BOOK_SEED = [
    { id:'b-spin', title:'SPIN Selling', author:'Neil Rackham', type:'book', notes:'Question-led discovery: Situation, Problem, Implication, Need-payoff.' },
    { id:'b-challenger', title:'The Challenger Sale', author:'Dixon & Adamson', type:'book', notes:'Teach, tailor, and take control of the conversation.' },
    { id:'b-voss', title:'Never Split the Difference', author:'Chris Voss', type:'book', notes:'Tactical empathy, calibrated questions, and labels.' },
    { id:'b-nvc', title:'Nonviolent Communication', author:'Marshall B. Rosenberg', type:'book', notes:'Observations, feelings, needs, requests.' },
    { id:'b-eq', title:'Emotional Intelligence', author:'Daniel Goleman', type:'book', notes:'Self-awareness and regulation in the moment.' },
    { id:'b-mbsr', title:'Mindfulness-Based Stress Reduction', author:'Jon Kabat-Zinn', type:'practice', notes:'A pause and a breath before reacting.' },
  ];
  const [books, setBooks] = React.useState(() => {
    try { const s = JSON.parse(localStorage.getItem('kithra_books')); return Array.isArray(s) ? s : BOOK_SEED; } catch(e){ return BOOK_SEED; }
  });
  React.useEffect(() => { try { localStorage.setItem('kithra_books', JSON.stringify(books)); } catch(e){}
    try { window.KithraCloud && window.KithraCloud.syncBooks && window.KithraCloud.syncBooks(books); } catch(e){} }, [books]);
  const addBook = React.useCallback((b) => setBooks(bs => [{ ...b, id: b.id || ('b-' + Date.now()), addedAt: Date.now() }, ...bs]), []);
  const updateBook = React.useCallback((id, patch) => setBooks(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b)), []);
  const removeBook = React.useCallback((id) => setBooks(bs => bs.filter(b => b.id !== id)), []);

  // ----- consent ledger (DPDP-style: explicit, purpose-limited, withdrawable, documented) -----
  const CONSENT_VERSION = '2026-06';
  const [consents, setConsents] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('kithra_consents')) || {}; } catch(e){ return {}; }
  });
  const persistConsents = (next) => { try { localStorage.setItem('kithra_consents', JSON.stringify(next)); } catch(e){}
    try { window.KithraCloud && window.KithraCloud.syncConsents && window.KithraCloud.syncConsents(next); } catch(e){} };
  const grantConsent = React.useCallback((purpose) => setConsents(c => { const n = { ...c, [purpose]: { granted:true, at:Date.now(), version:CONSENT_VERSION } }; persistConsents(n); return n; }), []);
  const withdrawConsent = React.useCallback((purpose) => setConsents(c => { const n = { ...c, [purpose]: { granted:false, at:Date.now(), version:CONSENT_VERSION } }; persistConsents(n); return n; }), []);
  const hasConsent = React.useCallback((purpose) => !!(consents[purpose] && consents[purpose].granted), [consents]);

  // ----- real account session (Supabase) + cross-session recording memory -----
  const [user, setUser] = React.useState(undefined); // undefined = checking, null = signed out
  const refreshUser = React.useCallback(async () => {
    try { const u = await (window.KithraCloud && window.KithraCloud.getUser && window.KithraCloud.getUser()); setUser(u || null); return u || null; }
    catch (e) { setUser(null); return null; }
  }, []);
  React.useEffect(() => { refreshUser(); }, []);
  // ----- finish OAuth (Google) redirect sign-in reliably -----
  // On return from Google, Supabase restores the session from the URL. Subscribe
  // to that event so the gate clears even if the first check beat the token
  // parse — and move the user INTO the app instead of stranding them on the
  // landing/home page (the returned #access_token hash isn't a normal route).
  React.useEffect(() => {
    const cameFromOAuth = /access_token=|[?&]code=|error=|error_description=/.test(String(window.location.hash) + String(window.location.search));
    let unsub = () => {};
    try {
      if (window.KithraCloud && window.KithraCloud.onAuthChange) {
        unsub = window.KithraCloud.onAuthChange(async (event) => {
          if (event === 'SIGNED_OUT') { setUser(null); return; }
          const u = await refreshUser();
          if (u && cameFromOAuth) go('dashboard');
        });
      }
    } catch (e) {}
    if (cameFromOAuth) refreshUser().then((u) => { if (u) go('dashboard'); });
    return () => { try { unsub(); } catch (e) {} };
  }, []);
  // ----- owner all-access -----
  // This specific account gets every feature unlocked, for free, while still
  // signing in normally. The email comes from the authenticated Supabase
  // session, so access follows the real logged-in identity.
  const OWNER_EMAILS = ['saraswatpraveen21@gmail.com'];
  const isOwner = !!(user && user.email && OWNER_EMAILS.includes(String(user.email).trim().toLowerCase()));
  const effectivePlan = isOwner ? 'premium' : plan;
  const plus = effectivePlan !== 'free';
  const planAllows = React.useCallback(
    (tier) => isOwner || (({ free:0, plus:1, premium:2 }[plan] ?? 0) >= ({ free:0, plus:1, premium:2 }[tier] ?? 0)),
    [plan, isOwner]
  );
  // re-check the session when the tab regains focus (e.g. returning from the
  // Google OAuth redirect) so the login gate clears without a manual reload.
  React.useEffect(() => {
    const h = () => { if (document.visibilityState === 'visible') refreshUser(); };
    document.addEventListener('visibilitychange', h);
    window.addEventListener('focus', h);
    return () => { document.removeEventListener('visibilitychange', h); window.removeEventListener('focus', h); };
  }, [refreshUser]);
  // stable account id: changes only when the identity actually changes (not on
  // every tab-focus session re-check), so we don't re-hydrate / leak audio URLs.
  const uid = user === undefined ? undefined : (user ? user.id : null);
  // Keep the recording owner current SYNCHRONOUSLY (during render), so a clip
  // saved right after sign-in can never be tagged with the stale 'local' owner.
  ownerRef.current = uid || 'local';
  // hydrate recordings: local-first (IndexedDB, with playable audio), then merge
  // any cloud-only rows. On sign-out, drop the in-memory list and free audio URLs
  // but KEEP on-device storage, so signing back in restores everything.
  React.useEffect(() => {
    let on = true;
    if (uid === undefined) return;            // still checking the session
    if (uid === null) {                       // signed out: clear memory, keep IDB
      setClips(cs => { cs.forEach(c => { if (c.url) { try { URL.revokeObjectURL(c.url); } catch (e) {} } }); return []; });
      return;
    }
    (async () => {
      // one-time: claim any legacy unowned/'local' clips on THIS device to the
      // signed-in account, then read STRICTLY scoped clips. New clips always
      // carry a real owner, so nothing here ever crosses accounts.
      try { await ClipStore.adoptLocal(uid); } catch (e) {}
      let local = [];
      try { local = await ClipStore.getClips(uid); } catch (e) {}
      if (!on) return;
      if (local.length) setClips(local);
      try {
        const rows = await (window.KithraCloud && window.KithraCloud.fetchRecordings && window.KithraCloud.fetchRecordings());
        if (on && Array.isArray(rows)) setClips(cs => { const have = new Set(cs.map(c => c.id)); return [...cs, ...rows.filter(r => !have.has(r.id))]; });
      } catch (e) {}
    })();
    return () => { on = false; };
  }, [uid]);
  const updateClip = React.useCallback((id, patch) => {
    setClips(cs => cs.map(c => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      // analysis is a nested bag (acoustic metrics + tone + transcript segments,
      // set by different features at different times) — MERGE it, never replace
      // it wholesale, or a later partial patch (e.g. just {tone}) would silently
      // erase earlier fields (e.g. wpm/talkRatio) still needed elsewhere.
      if (patch.analysis) next.analysis = { ...(c.analysis || {}), ...patch.analysis };
      try { if (window.KithraCloud && window.KithraCloud.configured()) window.KithraCloud.saveRecording(next); } catch (e) {}
      return next;
    }));
    try { ClipStore.patchClip(id, patch); } catch (e) {} // persist transcript/insights on-device
  }, []);

  // ----- "ask about this recording" focus -----
  const [askFocus, setAskFocus] = React.useState(null);

  // ----- PII redaction preference (applies to transcripts before display/storage) -----
  const [redact, setRedactState] = React.useState(() => { try { return localStorage.getItem('kithra_redact') !== '0'; } catch(e){ return true; } });
  const setRedact = React.useCallback((v) => { setRedactState(v); try { localStorage.setItem('kithra_redact', v ? '1' : '0'); } catch(e){} }, []);

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
  const captureRef = React.useRef(capture); captureRef.current = capture;

  // Android hardware/gesture back button. Registering a listener replaces
  // Capacitor's bare default (goBack() if the WebView has history, else
  // instantly kill the activity) — without this, back closes nothing, and
  // pressing it on the very first screen exits with zero warning, even mid a
  // live recording. Priority: an expanded Live Capture session minimizes
  // (never silently drops the session), then any open overlay/sheet closes,
  // then in-app route history, then a real "press again to exit".
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let lastBackAt = 0;
    const sub = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (captureRef.current.open) { minimizeCapture(); return; }
      const overlay = document.querySelector('.lc-overlay');
      if (overlay) { overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return; }
      const sheet = document.querySelector('.msheet');
      if (sheet) { sheet.querySelector('button[aria-label="Close"]')?.click(); return; }
      const permGate = document.querySelector('.kt-perm-overlay');
      if (permGate) {
        const skip = [...permGate.querySelectorAll('button')].find(b => /maybe later/i.test(b.textContent || ''));
        if (skip) skip.click();
        return;
      }
      if (canGoBack) { window.history.back(); return; }
      const now = Date.now();
      if (now - lastBackAt < 2000) { CapApp.exitApp(); return; }
      lastBackAt = now;
      showToast('Press back again to exit', 'x');
    });
    return () => { sub.then(h => h.remove()).catch(() => {}); };
  }, [minimizeCapture, showToast]);

  const data = window.LUMEN?.[t.mode] || window.LUMEN?.business;
  const ctx = {
    t, setTweak, route, go, convoId,
    data, mode: t.mode,
    flow: { goals, setGoals, goalText, setGoalText, files, setFiles, connections, setConnections,
            authNext, setAuthNext, authMode, setAuthMode, dashRange, setDashRange },
    voicePrefs, setVoice,
    capture, openCapture, closeCapture, minimizeCapture, expandCapture, setCapMode,
    plus, setPlus, plan: effectivePlan, setPlan, planAllows, isOwner, wiped, setWiped, toast, showToast, perms, savePerms,
    sidebarCollapsed, setSidebarCollapsed,
    clips, addClip, removeClip, viewClip, setViewClip,
    convoFrom, viewConvo, setViewConvo,
    books, addBook, updateBook, removeBook,
    consents, grantConsent, withdrawConsent, hasConsent,
    redact, setRedact,
    user, refreshUser, updateClip,
    askFocus, setAskFocus,
  };

  // ----- apply tokens to root -----
  const rootStyle = {
    '--radius-base': `${t.radius}px`,
    '--density': t.density === 'compact' ? 0.82 : 1,
    '--font-display': FONT_MAP[t.headlineFont] || FONT_MAP.newsreader,
    height:'100%',
  };

  // Mirror the theme onto <html> so the page canvas behind #lumen-root follows
  // it too — otherwise any scroll past the app frame exposes an untinted body.
  React.useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = t.theme;
    el.dataset.mode = t.mode;
  }, [t.theme, t.mode]);

  // Match the native status bar to Kithra's own theme — without this it's
  // whatever the OS default is, which can land light-on-light or dark-on-dark
  // against the app's own header and read as a glitch, not a design choice.
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const dark = t.theme === 'dark';
        await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
        await StatusBar.setBackgroundColor({ color: dark ? '#0a0b16' : '#f4f1ea' });
      } catch (e) {}
    })();
  }, [t.theme]);

  const isApp = ROUTES[route]?.app;
  // real login gate: app screens require a real account (Google or email).
  // No offline / local-only escape — an account is always required.
  const cloudConfigured = !!(window.KithraCloud && window.KithraCloud.configured && window.KithraCloud.configured());
  const needLogin = isApp && cloudConfigured && user === null;
  const checking = isApp && cloudConfigured && user === undefined;

  return (
    <AppContext.Provider value={ctx}>
      <div id="lumen-root" data-theme={t.theme} data-mode={t.mode} data-accent={t.accent} style={rootStyle}>
        {checking
          ? <div className="center" style={{ height:'100%' }}><LiveWave bars={14} height={28} /></div>
          : needLogin
            ? (window.Auth ? <window.Auth gate /> : null)
            : isApp ? <AppShell /> : <FullScreen route={route} />}
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
    legal: window.Legal,
  };
  const Screen = map[route] || window.Landing;
  return Screen ? <Screen /> : <Placeholder name={route} />;
}

/* ---------- app shell ---------- */
function AppShell() {
  const { route } = useApp();
  const isMobile = useIsMobile();
  const map = {
    dashboard: window.Dashboard,
    conversation: window.Conversation,
    ask: window.AskKithra,
    patterns: window.Patterns,
    library: window.Library,
    books: window.Books,
    analyze: window.Analyze,
    sources: window.SourcesPanel,
    privacy: window.Privacy,
    pricing: window.Pricing,
  };
  const Screen = map[route] || window.Dashboard;
  return (
    <div className={`app${isMobile ? ' is-mobile' : ''}`}>
      {!isMobile && <Sidebar />}
      <div className="app-main">
        {isMobile ? <MobileHeader /> : <Topbar />}
        <div className="app-scroll scroll">
          {Screen ? <Screen /> : <Placeholder name={route} />}
        </div>
        {isMobile && <MobileTabBar />}
      </div>
    </div>
  );
}

/* ---------- sidebar ---------- */
function Sidebar() {
  const { route, go, sidebarCollapsed, setSidebarCollapsed, planAllows, openCapture, capture, expandCapture } = useApp();
  const capActive = !!(capture && (capture.open || capture.minimized));
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
        <div className="stack brand-text" style={{ gap:2, minWidth:0 }}>
          <span className="wordmark" style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:600, letterSpacing:'-.02em', lineHeight:1 }}>Kithra</span>
          <span className="brand-tag" style={{ fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:10.5, color:'var(--ink-3)', letterSpacing:'.01em', whiteSpace:'nowrap' }}>Where talk becomes insight</span>
        </div>
      </div>
      <div className="nav-group">
        <a className={`nav-item nav-live ${capActive?'nav-live-on':''}`} onClick={()=> capActive ? expandCapture() : openCapture('listen')}
          title={capActive ? 'Live capture is running — tap to open' : 'Start live voice capture'}>
          <span className="ic nav-live-ic"><Icon name="mic" size={19} fill={capActive} /></span>
          <span className="lbl">{capActive ? `Live · ${capture.capMode==='converse'?'Conversation':'Listening'}` : 'Live capture'}</span>
          {capActive && <span className="lc-notif-dot" data-on="1" style={{ marginLeft:'auto' }} />}
        </a>
        {!capActive && (
          <div className="side-quickcap">
            <button className="side-quickcap-btn" onClick={()=>openCapture('listen')}><Icon name="wave" size={12} />Listen</button>
            <button className="side-quickcap-btn" onClick={()=>openCapture('converse')}><Icon name="chat" size={12} />Converse</button>
          </div>
        )}
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
        <a className="nav-item" onClick={()=>go('dashboard')} title="Dashboard">
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
      <div className="searchbox click" style={{ width:230, maxWidth:'26vw' }} role="button" tabIndex={0}
        aria-label="Ask across your data"
        onClick={()=>go('ask')}
        onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); go('ask'); } }}>
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
// derive a friendly name + initials from the real Supabase user
function userIdentity(user) {
  const md = (user && user.user_metadata) || {};
  const name = md.full_name || md.name || (user && user.email) || (user && user.phone) || 'Your account';
  const sub = (user && user.email) || (user && user.phone) || 'Signed in';
  const initials = String(name).replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'K';
  const avatar = md.avatar_url || md.picture || null;
  return { name, sub, initials, avatar };
}
function AccountMenu() {
  const { go, plan, mode, user, refreshUser, showToast } = useApp();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const id = userIdentity(user);
  const items = [
    { ic:'user', label:'Profile', act:()=>go('privacy') },
    { ic:'spark', label:'Plans & billing', act:()=>go('pricing') },
    { ic:'layers', label:'My recordings', act:()=>go('library') },
    { ic:'shield', label:'Privacy & data', act:()=>go('privacy') },
  ];
  const signOut = async () => {
    setOpen(false);
    try { await (window.KithraCloud && window.KithraCloud.signOut && window.KithraCloud.signOut()); } catch (e) {}
    try { await refreshUser(); } catch (e) {}
    showToast('Signed out', 'check');
    go('landing');
  };
  const AvatarEl = ({ size }) => id.avatar
    ? <img src={id.avatar} alt="" width={size} height={size} style={{ borderRadius:'50%', objectFit:'cover', display:'block' }} />
    : <Avatar label={id.initials} color="var(--viz-1)" size={size} />;
  return (
    <div className="dd" ref={ref}>
      <button onClick={()=>setOpen(o=>!o)} style={{ border:0, background:'transparent', padding:0, cursor:'pointer', borderRadius:'50%' }} aria-label="Account">
        <AvatarEl size={36} />
      </button>
      {open && (
        <div className="dd-menu" style={{ minWidth:230, right:0, left:'auto' }}>
          <div className="row" style={{ gap:10, padding:'8px 10px 10px' }}>
            <AvatarEl size={34} />
            <div className="stack" style={{ gap:1, minWidth:0 }}>
              <span style={{ fontWeight:700, fontSize:13.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{id.name}</span>
              <span className="faint tcap" style={{ fontSize:11.5 }}>{plan} plan · {mode}</span>
            </div>
          </div>
          <div className="hr" style={{ margin:'2px 0 5px' }} />
          {items.map((it,i)=>(
            <button key={i} className="dd-item" onClick={()=>{ setOpen(false); it.act(); }}><Icon name={it.ic} size={16} /><span className="grow" style={{ textAlign:'left' }}>{it.label}</span></button>
          ))}
          <div className="hr" style={{ margin:'5px 0' }} />
          <button className="dd-item" onClick={signOut}><Icon name="arrowR" size={16} /><span className="grow" style={{ textAlign:'left' }}>Sign out</span></button>
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
              onClick={()=>{
                setOpen(false);
                if (p.k===plan) return;
                // downgrade to Free is instant; paid tiers go through real checkout
                if (p.k==='free') { setPlan('free'); showToast('Switched to Free', 'check'); }
                else go('pricing');
              }}>
              <span className="center" style={{ width:24, height:24, borderRadius:7, background:`color-mix(in srgb,${p.color} 16%, transparent)`, color:p.color, flex:'none', marginTop:1 }}><Icon name="spark" size={13} fill={p.k!=='free'} /></span>
              <span className="stack grow" style={{ gap:1, minWidth:0 }}>
                <span style={{ fontWeight:700, fontSize:13.5 }}>{p.label}</span>
                <span className="faint" style={{ fontSize:11.5, lineHeight:1.3 }}>{p.sub}{p.k!=='free' ? (p.k==='premium'?' · $90/mo':' · $30/mo') : ''}</span>
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
