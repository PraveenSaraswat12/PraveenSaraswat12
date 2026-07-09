import React from 'react';
/* ============================================================
   LUMEN — shared components (icons, logo, waveform, primitives)
   ============================================================ */

/* ---------- Icon set (24x24 stroke) ---------- */
const ICONS = {
  home:'M3 11.5 12 4l9 7.5M5.5 9.7V20h13V9.7',
  grid:'M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z',
  chat:'M4 5h16v11H9l-4 3.5V16H4z',
  wave:'M3 12h2M7 7v10M11 4v16M15 8v8M19 10v4M21 12h0',
  trend:'M4 16l5-5 3 3 7-8M16 6h4v4',
  shield:'M12 3l7 3v6c0 4.2-3 7-7 8-4-1-7-3.8-7-8V6z',
  upload:'M12 16V5M8 9l4-4 4 4M5 19h14',
  settings:'M12 9a3 3 0 100 6 3 3 0 000-6zM19.4 13a1.6 1.6 0 00.3 1.7l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.2A1.6 1.6 0 005 19.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 002.7 14H2.5a2 2 0 110-4h.2A1.6 1.6 0 004.7 7L4.6 7a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 4.6V4.5a2 2 0 014 0v.2a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.7v.1a1.6 1.6 0 001.5 1H21a2 2 0 010 4h-.2a1.6 1.6 0 00-1.4 1z',
  search:'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-3.5-3.5',
  sun:'M12 4V2M12 22v-2M4 12H2M22 12h-2M6 6L4.5 4.5M19.5 19.5 18 18M6 18l-1.5 1.5M19.5 4.5 18 6M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z',
  moon:'M20 14.5A8 8 0 019.5 4 7.5 7.5 0 1020 14.5z',
  chevR:'M9 5l7 7-7 7',
  chevD:'M5 9l7 7 7-7',
  chevL:'M15 5l-7 7 7 7',
  plus:'M12 5v14M5 12h14',
  play:'M7 5l12 7-12 7z',
  pause:'M8 5v14M16 5v14',
  mic:'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3',
  file:'M6 3h8l4 4v14H6zM14 3v4h4',
  check:'M5 12.5l4.5 4.5L19 7',
  arrowUR:'M7 17L17 7M8 7h9v9',
  arrowR:'M5 12h14M13 6l6 6-6 6',
  briefcase:'M4 8h16v11H4zM9 8V6a2 2 0 012-2h2a2 2 0 012 2v2',
  user:'M12 12a4 4 0 100-8 4 4 0 000 8zM5 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5',
  lock:'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  link:'M9 15l6-6M8.5 11.5l-1 1a3 3 0 004 4l1-1M15.5 12.5l1-1a3 3 0 00-4-4l-1 1',
  x:'M6 6l12 12M18 6L6 18',
  menu:'M4 7h16M4 12h16M4 17h16',
  filter:'M4 5h16l-6 8v5l-4 2v-7z',
  calendar:'M5 6h14v14H5zM5 10h14M9 4v3M15 4v3',
  more:'M6 12h.01M12 12h.01M18 12h.01',
  clock:'M12 4a8 8 0 100 16 8 8 0 000-16zM12 8v4l3 2',
  send:'M5 12l15-7-7 15-2-6z',
  download:'M12 4v11M8 11l4 4 4-4M5 19h14',
  trash:'M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13',
  spark:'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  heart:'M12 20s-7-4.3-9.2-8.2C1.3 8.9 3 5.5 6.2 5.5c2 0 3 1.3 3.8 2.4.8-1.1 1.8-2.4 3.8-2.4 3.2 0 4.9 3.4 3.4 6.3C19 15.7 12 20 12 20z',
  target:'M12 4a8 8 0 100 16 8 8 0 000-16zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.5a.5.5 0 100 1 .5.5 0 000-1z',
  flame:'M12 3c1 3-2 4-2 7a2.5 2.5 0 005 .3C16 12 14 9 12 3zM8.5 13a3.5 3.5 0 107 0c0 3-3.5 4-3.5 8-0-4-3.5-5-3.5-8z',
  bolt:'M13 3L5 13h5l-1 8 8-10h-5z',
  google:'M21 12.2c0-.7-.1-1.3-.2-2H12v3.8h5.1a4.4 4.4 0 01-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-7.1z M12 21c2.4 0 4.5-.8 6-2.2l-3.1-2.4c-.8.6-1.9.9-2.9.9-2.3 0-4.2-1.5-4.9-3.6H3.8v2.4A9 9 0 0012 21z M7.1 13.7a5.4 5.4 0 010-3.4V7.9H3.8a9 9 0 000 8.2z M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 003.8 7.9l3.3 2.4C7.8 8.1 9.7 6.6 12 6.6z',
  teams:'M4 7h9v10H4zM7 9.5h3M8.5 9.5V15M14 8a2 2 0 100-4 2 2 0 000 4zM13 10h7v5a3.5 3.5 0 01-7 0z',
  zoom:'M4 7h11a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2zM19 10l3-2v8l-3-2z',
  sliders:'M4 8h10M18 8h2M4 16h2M10 16h10M14 6v4M8 14v4',
  eye:'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  refresh:'M4 12a8 8 0 0113.7-5.6L20 8M20 4v4h-4M20 12a8 8 0 01-13.7 5.6L4 16M4 20v-4h4',
  layers:'M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4',
  quote:'M7 7H5a2 2 0 00-2 2v3h4V9h0zM17 7h-2a2 2 0 00-2 2v3h4V9z',
  drive:'M8 4h8l5 9-4 7H7l-4-7zM8 4l-4 9M16 4l4 9M3 13h18',
  book:'M5 5a2 2 0 012-2h11v15H7a2 2 0 00-2 2zM18 18H7a2 2 0 00-2 2M9 7h6M9 10h4',
  leaf:'M4 20c0-9 7-15 16-14 1 9-5 15-14 14zM5 19c3-6 8-9 12-10',
  stethoscope:'M6 4v5a4 4 0 008 0V4M6 4H4M14 4h2M10 17a4 4 0 008 0v-2M18 13a1.5 1.5 0 100 .01',
  phone:'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
};
function Icon({ name, size = 20, stroke = 2, fill = false, className = '', style }) {
  const d = ICONS[name] || '';
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24"
         fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  );
}

/* ---------- Kithra logo: aperture + soundwave mark ---------- */
function LumenMark({ size = 30 }) {
  const id = React.useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-strong)" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="9" fill={`url(#${id})`} />
      <g stroke="var(--accent-ink)" strokeWidth="2.1" strokeLinecap="round">
        <line x1="9" y1="16" x2="9" y2="16.01" opacity="0" />
        <line x1="9" y1="13" x2="9" y2="19" />
        <line x1="13" y1="9.5" x2="13" y2="22.5" />
        <line x1="16" y1="12" x2="16" y2="20" />
        <line x1="19" y1="8" x2="19" y2="24" />
        <line x1="23" y1="13.5" x2="23" y2="18.5" />
      </g>
    </svg>
  );
}
function Wordmark({ size = 30, showText = true }) {
  return (
    <div className="row" style={{ gap: 11 }}>
      <LumenMark size={size} />
      {showText && (
        <span className="wordmark" style={{ fontFamily:'var(--font-display)', fontSize: size*0.78, fontWeight:600, letterSpacing:'-.02em', color:'var(--ink)' }}>
          Kithra
        </span>
      )}
    </div>
  );
}

/* ---------- Waveform ---------- */
// deterministic pseudo-random heights
function waveHeights(n, seed = 1, min = 0.18) {
  const out = [];
  let s = seed * 9301 + 49297;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    const env = Math.sin((i / n) * Math.PI); // arch envelope
    out.push(min + (1 - min) * (0.35 + 0.65 * r) * (0.5 + 0.5 * env));
  }
  return out;
}
// Static decorative waveform
function Waveform({ bars = 48, seed = 3, height = 40, color = 'var(--accent)', gap = 3, progress = -1, opacityTail = false }) {
  const hs = React.useMemo(() => waveHeights(bars, seed), [bars, seed]);
  return (
    <div className="wave" style={{ height, '--wb-gap': gap + 'px' }}>
      {hs.map((h, i) => {
        const played = progress >= 0 && i / bars <= progress;
        const c = progress >= 0 ? (played ? color : 'var(--line-2)') : color;
        const op = opacityTail ? (0.4 + 0.6 * h) : 1;
        return <i key={i} style={{ height: `${Math.round(h * 100)}%`, background: c, opacity: op }} />;
      })}
    </div>
  );
}
// Animated "listening" waveform (for processing / mic)
function LiveWave({ bars = 40, height = 56, color = 'var(--accent)', speed = 1 }) {
  const [, force] = React.useReducer(x => x + 1, 0);
  const ref = React.useRef(waveHeights(bars, 7));
  React.useEffect(() => {
    let raf, t0 = performance.now();
    const tick = (t) => {
      if (t - t0 > 90 / speed) {
        ref.current = ref.current.map((_, i) => {
          const env = Math.sin((i / bars) * Math.PI);
          return 0.12 + (0.25 + 0.75 * Math.random()) * (0.4 + 0.6 * env);
        });
        t0 = t; force();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bars, speed]);
  return (
    <div className="wave" style={{ height, '--wb-gap': '3px' }}>
      {ref.current.map((h, i) => <i key={i} style={{ height: `${Math.round(h*100)}%`, background: color, transition:'height .09s linear' }} />)}
    </div>
  );
}

/* ---------- small UI ---------- */
function Avatar({ label, color, size = 34 }) {
  return <div className="avatar" style={{ width:size, height:size, background:color, fontSize:size*0.38 }}>{label}</div>;
}
function Badge({ kind = 'neutral', children, dot }) {
  return <span className={`badge badge-${kind}`}>{dot && <i className="dot" style={{ background:'currentColor' }} />}{children}</span>;
}
function Delta({ value, label, invert }) {
  const up = value > 0; const dir = up ? 'up' : value < 0 ? 'down' : 'flat';
  const cls = invert ? (up ? 'down' : 'up') : dir;
  const sign = up ? '+' : '';
  return (
    <span className={`delta ${value === 0 ? 'flat' : cls}`}>
      {value !== 0 && <Icon name={up ? 'arrowUR' : 'arrowUR'} size={12} stroke={2.4} style={{ transform: up ? 'none' : 'rotate(90deg)' }} />}
      {sign}{value}{label ? '' : ''}
    </span>
  );
}
function SentDot({ s }) {
  const map = { pos:{c:'var(--good)',l:'Positive'}, neg:{c:'var(--bad)',l:'Tense'}, neu:{c:'var(--ink-3)',l:'Neutral'} };
  const m = map[s] || map.neu;
  return <span className="row" style={{ gap:6, fontSize:12, color:'var(--ink-2)', fontWeight:500 }}><i className="dot" style={{ background:m.c }} />{m.l}</span>;
}
function StatusPill({ status }) {
  const map = {
    analyzed:{ k:'good', t:'Analyzed' },
    transcribing:{ k:'accent', t:'Transcribing' },
    queued:{ k:'neutral', t:'Queued' },
  };
  const m = map[status] || map.queued;
  return <Badge kind={m.k} dot={status==='transcribing'}>{m.t}</Badge>;
}

/* ---------- privacy lock chip (recurring trust motif) ---------- */
function PrivacyChip({ text = 'End-to-end encrypted' }) {
  return (
    <span className="row" style={{ gap:7, fontSize:12.5, color:'var(--ink-2)', fontWeight:500 }}>
      <span className="center" style={{ width:22, height:22, borderRadius:7, background:'var(--good-soft)', color:'var(--good)' }}>
        <Icon name="lock" size={13} stroke={2.2} />
      </span>
      {text}
    </span>
  );
}

/* ---------- Dropdown (working filter) ---------- */
function Dropdown({ icon, label, value, options, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const cur = options.find(o => o.value === value) || options[0];
  return (
    <div className="dd" ref={ref}>
      <button className={`chip ${open ? 'is-active' : ''}`} style={{ height:38 }} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {icon && <Icon name={icon} size={15} />}
        {label && <span className="faint" style={{ fontWeight:500 }}>{label}:</span>}
        <span style={{ fontWeight:600, color:'var(--ink)' }}>{cur.label}</span>
        <Icon name="chevD" size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform .18s' }} />
      </button>
      {open && (
        <div className="dd-menu scroll">
          {options.map(o => (
            <button key={o.value} className={`dd-item ${o.value === value ? 'on' : ''}`} onClick={() => { onChange(o.value); setOpen(false); }}>
              {o.icon && <Icon name={o.icon} size={15} />}
              <span className="grow" style={{ textAlign:'left' }}>{o.label}</span>
              {o.value === value && <Icon name="check" size={15} stroke={2.6} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Evidence / source grounding ---------- */
const SRC_ICON = { book:'book', research:'layers', practitioner:'stethoscope', framework:'target', practice:'leaf' };
const SRC_LABEL = { book:'Book', research:'Research', practitioner:'Practitioner', framework:'Framework', practice:'Practice' };
function EvidenceList({ items, label = 'Informed by' }) {
  if (!items || !items.length) return null;
  return (
    <div>
      <span className="eyebrow row" style={{ display:'flex', gap:7, marginBottom:9 }}><Icon name="leaf" size={14} />{label}</span>
      <div className="stack" style={{ gap:7 }}>
        {items.map((s, i) => (
          <div key={i} className="evidence-chip">
            <span className="center evidence-ic"><Icon name={SRC_ICON[s.type] || 'book'} size={15} /></span>
            <div className="stack grow" style={{ gap:1, minWidth:0 }}>
              <span style={{ fontWeight:650, fontSize:13, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</span>
              <span className="faint" style={{ fontSize:11.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.author}</span>
            </div>
            <span className="tag" style={{ height:22, fontSize:10.5, flex:'none' }}>{SRC_LABEL[s.type] || 'Source'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- PII redaction (masks emails, phones, long numbers) ---------- */
function redactPII(text) {
  if (!text) return text;
  return String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(?:\+?\d[\d\s\-().]{7,}\d)/g, (m) => (m.replace(/\D/g, '').length >= 8 ? '[phone]' : m))
    .replace(/\b\d{6,}\b/g, '[number]');
}

/* ---------- Real audio player (plays an actual uploaded/recorded file) ----------
   forwardRef exposes { seekTo(t), play(), pause() } and an optional onTime(t)
   callback fires on every timeupdate — together these let a parent (e.g. an
   interactive transcript) drive and follow playback without owning the <audio>
   element itself. ---------- */
const RealPlayer = React.forwardRef(function RealPlayer({ src, peaks, durSec = 0, accent = 'var(--accent)', onTime: onTimeProp }, fwdRef) {
  const audioRef = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);
  const [cur, setCur] = React.useState(0);
  const [total, setTotal] = React.useState(durSec || 0);
  React.useEffect(() => { setPlaying(false); setCur(0); setTotal(durSec || 0); }, [src, durSec]);
  const fmt = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
  const frac = total ? Math.min(1, cur / total) : 0;
  const toggle = () => { const a = audioRef.current; if (!a) return; if (a.paused) a.play().catch(() => {}); else a.pause(); };
  const onTime = () => { const a = audioRef.current; if (a) { const t = a.currentTime || 0; setCur(t); if (onTimeProp) onTimeProp(t); } };
  const onMeta = () => { const a = audioRef.current; if (a && isFinite(a.duration) && a.duration > 0) setTotal(a.duration); };
  const seek = (e) => { const a = audioRef.current; if (!a || !total) return; const r = e.currentTarget.getBoundingClientRect(); const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); try { a.currentTime = f * total; setCur(f * total); } catch (_) {} };
  React.useImperativeHandle(fwdRef, () => ({
    seekTo(t, autoplay = true) {
      const a = audioRef.current; if (!a) return;
      try { a.currentTime = Math.max(0, t); setCur(a.currentTime); if (autoplay) a.play().catch(() => {}); } catch (_) {}
    },
    play() { audioRef.current?.play().catch(() => {}); },
    pause() { audioRef.current?.pause(); },
  }), []);
  return (
    <div className="row" style={{ gap: 14, alignItems: 'center' }}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: 'none' }}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={onTime} onLoadedMetadata={onMeta} onDurationChange={onMeta} />
      <button type="button" className="btn btn-icon btn-primary" style={{ width: 46, height: 46, borderRadius: '50%', flex: 'none' }} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        <Icon name={playing ? 'pause' : 'play'} size={19} fill />
      </button>
      <div className="grow" style={{ minWidth: 0, cursor: 'pointer' }} onClick={seek} title="Click to seek" aria-label="Seek through audio">
        {peaks && peaks.length
          ? <div className="wave" style={{ height: 44, '--wb-gap': '2px' }}>
              {peaks.map((h, i) => { const played = (i / peaks.length) <= frac; return <i key={i} style={{ height: `${Math.max(4, Math.round(h * 100))}%`, background: played ? accent : 'var(--line-2)' }} />; })}
            </div>
          : <Waveform bars={72} seed={5} height={44} progress={frac} gap={2} color={accent} />}
      </div>
      <span className="tnum faint" style={{ fontSize: 12, flex: 'none', minWidth: 88, textAlign: 'right' }}>{fmt(cur)} / {fmt(total)}</span>
    </div>
  );
});

Object.assign(window, {
  Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights,
  Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, RealPlayer, redactPII,
});


export { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, RealPlayer, redactPII };
