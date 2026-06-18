import React from 'react';
import { Icon, LumenMark, Avatar, PrivacyChip, useApp, ROUTES } from './kit.js';

/* ============================================================
   KITHRA — Mobile shell (phone-native chrome)

   WHY A BOTTOM TAB BAR (the pattern decision)
   -------------------------------------------
   We compared four navigation patterns for this multi-destination
   app on a phone held one-handed:

   • Icon rail (what shipped before): a shrunk desktop sidebar. The
     targets live on the LEFT EDGE, top-to-bottom — the hardest zone
     to reach with a thumb — and it eats horizontal width. Feels like
     a website squeezed onto a phone. ✗
   • Hamburger drawer: hides every primary destination behind a tap,
     so the app's main surfaces (Dashboard / Ask / Patterns) are never
     visible. Kills discoverability + adds a tap to every jump. ✗
   • Top segmented tabs: live in the top "stretch" zone (worst for a
     thumb) and don't scale past ~3 short labels. ✗
   • Bottom tab bar (4 primary tabs + a "More" sheet): persistent,
     thumb-reachable, always shows where you are and where you can go.
     This is the proven native pattern (Instagram, Spotify, Linear,
     iOS/Material). ✓  ← chosen.

   So on phones we render:
     - a sticky MobileHeader (page title + the ONE key action),
     - a fixed MobileTabBar (Dashboard · Ask · Patterns · Recordings · More),
     - a MoreSheet bottom-sheet for secondary destinations + account.
   Everything is gated behind `useIsMobile()` (and CSS media queries),
   so the desktop experience is byte-for-byte unchanged.
   ============================================================ */

export const MOBILE_BP = 760; // px — phone breakpoint (matches mobile.css)

// Reactive "are we on a phone?" — drives which chrome the shell renders.
export function useIsMobile() {
  const get = () => (typeof window !== 'undefined'
    ? window.matchMedia(`(max-width:${MOBILE_BP}px)`).matches : false);
  const [m, setM] = React.useState(get);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width:${MOBILE_BP}px)`);
    const on = () => setM(mq.matches);
    on();
    // addEventListener('change') is the modern API; addListener is the fallback
    if (mq.addEventListener) mq.addEventListener('change', on);
    else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
  }, []);
  return m;
}

// lock body scroll while a sheet is open (so the page behind doesn't move)
function useScrollLock(active) {
  React.useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

/* ---------- friendly name/initials/avatar from the Supabase user ---------- */
function mobileIdentity(user) {
  const md = (user && user.user_metadata) || {};
  const name = md.full_name || md.name || (user && user.email) || (user && user.phone) || 'Your account';
  const sub = (user && user.email) || (user && user.phone) || 'Signed in';
  const initials = String(name).replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'K';
  const avatar = md.avatar_url || md.picture || null;
  return { name, sub, initials, avatar };
}

/* ============================================================
   BottomSheet — reusable slide-up sheet (native modal feel)
   Renders a scrim + a rounded panel that clears the gesture bar.
   ============================================================ */
export function BottomSheet({ open, onClose, title, children, maxHeight = '82vh' }) {
  const [mounted, setMounted] = React.useState(open);
  const [shown, setShown] = React.useState(false);
  useScrollLock(open);
  React.useEffect(() => {
    if (open) {
      setMounted(true);
      // next frame -> add .in so the transform/opacity transition runs
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    } else {
      setShown(false);
      const t = setTimeout(() => setMounted(false), 280);
      return () => clearTimeout(t);
    }
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return (
    <div className={`msheet-scrim ${shown ? 'in' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }} role="dialog" aria-modal="true">
      <div className={`msheet ${shown ? 'in' : ''}`} style={{ maxHeight }}>
        <button className="msheet-grab" onClick={onClose} aria-label="Close" />
        {title && (
          <div className="msheet-head">
            <span className="msheet-title">{title}</span>
            <button className="msheet-x" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
          </div>
        )}
        <div className="msheet-body scroll">{children}</div>
      </div>
    </div>
  );
}

/* ============================================================
   MoreSheet — secondary destinations + account, theme, plan
   ============================================================ */
function MoreSheet({ open, onClose }) {
  const { go, route, t, setTweak, plan, mode, user, refreshUser, showToast, planAllows } = useApp();
  const id = mobileIdentity(user);

  const nav = (r) => { onClose(); go(r); };
  const signOut = async () => {
    onClose();
    try { await (window.KithraCloud && window.KithraCloud.signOut && window.KithraCloud.signOut()); } catch (e) {}
    try { await refreshUser(); } catch (e) {}
    showToast('Signed out', 'check');
    go('landing');
  };

  // secondary destinations (everything not on the primary tab bar)
  const dests = [
    { id:'books',    ic:'book',   label:'Books',          sub:'Knowledge that grounds insights' },
    { id:'analyze',  ic:'mic',    label:'Analyze audio',  sub:'Transcribe & break down a clip' },
    { id:'sources',  ic:'upload', label:'Sources',        sub:'Connect & import conversations' },
    { id:'privacy',  ic:'shield', label:'Privacy & Data', sub:'Consent, redaction, export' },
    { id:'pricing',  ic:'spark',  label:'Plans',          sub:'Compare Free · Plus · Premium' },
  ];

  const AvatarEl = ({ size }) => id.avatar
    ? <img src={id.avatar} alt="" width={size} height={size} style={{ borderRadius:'50%', objectFit:'cover', display:'block' }} />
    : <Avatar label={id.initials} color="var(--viz-1)" size={size} />;

  return (
    <BottomSheet open={open} onClose={onClose} title="More">
      {/* account header */}
      <button className="msheet-acct" onClick={() => nav('privacy')}>
        <AvatarEl size={44} />
        <span className="stack grow" style={{ gap:2, minWidth:0, textAlign:'left' }}>
          <span className="msheet-acct-name">{id.name}</span>
          <span className="msheet-acct-sub tcap">{plan} plan · {mode}</span>
        </span>
        <Icon name="chevR" size={18} />
      </button>

      {/* secondary destinations */}
      <div className="msheet-list">
        {dests.map(d => {
          const locked = d.id === 'patterns' && !planAllows('plus');
          return (
            <button key={d.id} className={`msheet-row ${route === d.id ? 'on' : ''}`} onClick={() => nav(d.id)}>
              <span className="msheet-row-ic"><Icon name={d.ic} size={20} /></span>
              <span className="stack grow" style={{ gap:1, minWidth:0, textAlign:'left' }}>
                <span className="msheet-row-label">{d.label}</span>
                <span className="msheet-row-sub">{d.sub}</span>
              </span>
              {locked
                ? <span className="lock-pill" data-tier="plus"><Icon name="lock" size={9} />Plus</span>
                : <Icon name="chevR" size={17} style={{ opacity:.5 }} />}
            </button>
          );
        })}
      </div>

      {/* quick controls */}
      <div className="msheet-controls">
        <button className="msheet-ctrl" onClick={() => setTweak('theme', t.theme === 'dark' ? 'light' : 'dark')}>
          <Icon name={t.theme === 'dark' ? 'sun' : 'moon'} size={18} />
          <span>{t.theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <button className="msheet-ctrl" onClick={() => setTweak('mode', mode === 'business' ? 'personal' : 'business')}>
          <Icon name={mode === 'business' ? 'heart' : 'briefcase'} size={18} />
          <span>{mode === 'business' ? 'Personal' : 'Business'}</span>
        </button>
      </div>

      <button className="msheet-signout" onClick={signOut}>
        <Icon name="arrowR" size={17} /><span>Sign out</span>
      </button>

      <div className="msheet-foot"><PrivacyChip text="Private · encrypted workspace" /></div>
    </BottomSheet>
  );
}

/* ============================================================
   MobileTabBar — fixed, thumb-reachable primary nav
   ============================================================ */
export function MobileTabBar() {
  const { route, go } = useApp();
  const [moreOpen, setMoreOpen] = React.useState(false);

  // primary destinations (4) + More. These are the app's main surfaces.
  const tabs = [
    { id:'dashboard', ic:'grid',   label:'Home' },
    { id:'ask',       ic:'chat',   label:'Ask' },
    { id:'patterns',  ic:'trend',  label:'Patterns' },
    { id:'library',   ic:'layers', label:'Recordings' },
  ];
  // routes that live INSIDE the More sheet — keep More lit when on one of them
  const moreRoutes = ['books', 'analyze', 'sources', 'privacy', 'pricing'];
  const moreActive = moreOpen || moreRoutes.includes(route);

  const Tab = ({ id, ic, label, active, onClick }) => (
    <button className={`mtab ${active ? 'active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <span className="mtab-ic"><Icon name={ic} size={23} /></span>
      <span className="mtab-lbl">{label}</span>
    </button>
  );

  return (
    <>
      <nav className="mtabbar" role="tablist" aria-label="Primary">
        {tabs.map(tb => (
          <Tab key={tb.id} {...tb} active={route === tb.id && !moreOpen} onClick={() => { setMoreOpen(false); go(tb.id); }} />
        ))}
        <Tab id="more" ic="menu" label="More" active={moreActive} onClick={() => setMoreOpen(o => !o)} />
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}

/* ============================================================
   MobileHeader — sticky top bar: brand/title + the ONE key action
   The single most useful action per screen (everything else lives
   on the screen itself or in the More sheet).
   ============================================================ */
export function MobileHeader() {
  const { route, go, t, setTweak } = useApp();
  const title = ROUTES[route]?.label || 'Kithra';

  // the one key action for each screen (icon + handler). null = no action.
  const ACTIONS = {
    dashboard: { ic:'plus',   label:'Add recording', act:() => go('analyze') },
    ask:       { ic:'mic',    label:'Voice',         act:() => go('analyze') },
    library:   { ic:'plus',   label:'Add recording', act:() => go('analyze') },
    analyze:   { ic:'plus',   label:'New',           act:() => go('analyze') },
    books:     { ic:'plus',   label:'Add book',      act:() => go('books') },
    patterns:  null,
    privacy:   null,
    pricing:   null,
  };
  const action = ACTIONS[route];

  return (
    <header className="mhead">
      <div className="mhead-brand" role="button" tabIndex={0} aria-label="Kithra home"
        onClick={() => go('dashboard')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('dashboard'); } }}>
        <LumenMark size={28} />
      </div>
      <h1 className="mhead-title">{title}</h1>
      <div className="grow" />
      <button className="mhead-btn" onClick={() => setTweak('theme', t.theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
        <Icon name={t.theme === 'dark' ? 'sun' : 'moon'} size={19} />
      </button>
      {action && (
        <button className="mhead-action" onClick={action.act} aria-label={action.label}>
          <Icon name={action.ic} size={18} />
        </button>
      )}
    </header>
  );
}

Object.assign(window, { MobileTabBar, MobileHeader, BottomSheet, useIsMobile });

export default MobileTabBar;
