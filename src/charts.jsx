import React from 'react';
import { Delta } from './components.jsx';
/* ============================================================
   LUMEN — charts (SVG, animated, theme-reactive)
   ============================================================ */

/* smooth path through points (Catmull-Rom -> cubic bezier) */
function smoothPath(pts) {
  if (pts.length < 2) return '';
  const d = [`M ${pts[0][0]} ${pts[0][1]}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`);
  }
  return d.join(' ');
}

/* hook: trigger animation shortly after mount */
function useMounted(delay = 60) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setOn(true), delay); return () => clearTimeout(t); }, [delay]);
  return on;
}

/* ---------- Sparkline ---------- */
function Sparkline({ data, color = 'var(--accent)', width = 120, height = 38, fill = true, strokeW = 2 }) {
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const pad = 3;
  const pts = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (width - pad * 2),
    height - pad - ((v - min) / rng) * (height - pad * 2),
  ]);
  const line = smoothPath(pts);
  const id = React.useId();
  const on = useMounted();
  return (
    <svg className="chart-glow" width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" style={{ overflow:'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${line} L ${pts[pts.length-1][0]} ${height} L ${pts[0][0]} ${height} Z`} fill={`url(#${id})`}
        style={{ opacity:on?1:0, transition:'opacity .6s ease .2s' }} />}
      <path d={line} stroke={color} strokeWidth={strokeW} strokeLinecap="round" vectorEffect="non-scaling-stroke"
        style={{ strokeDasharray:600, strokeDashoffset:on?0:600, transition:'stroke-dashoffset 1.1s var(--ease)' }} />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.6" fill={color}
        style={{ opacity:on?1:0, transition:'opacity .3s ease .9s' }} />
    </svg>
  );
}

/* ---------- LineChart (multi-series) ---------- */
function LineChart({ series, height = 220, yMax, yMin = 0, labels, area = true, grid = true, strokeW = 2.4 }) {
  const W = 720, H = height, padL = 8, padR = 12, padT = 16, padB = labels ? 26 : 12;
  const allY = series.flatMap(s => s.data.map(d => d.y));
  const max = yMax != null ? yMax : Math.max(...allY) * 1.12;
  const min = yMin != null ? yMin : Math.min(...allY);
  const rng = max - min || 1;
  const n = series[0].data.length;
  const X = i => padL + (i / (n - 1)) * (W - padL - padR);
  const Y = v => padT + (1 - (v - min) / rng) * (H - padT - padB);
  const on = useMounted();
  const gridLines = grid ? [0, 0.25, 0.5, 0.75, 1] : [];
  return (
    <svg className="chart-glow" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} fill="none" preserveAspectRatio="none" style={{ overflow:'visible' }}>
      {gridLines.map((g, i) => (
        <line key={i} x1={padL} x2={W - padR} y1={padT + g * (H - padT - padB)} y2={padT + g * (H - padT - padB)}
          stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={i===4?'0':'3 5'} />
      ))}
      {series.map((s, si) => {
        const pts = s.data.map((d, i) => [X(i), Y(d.y)]);
        const path = smoothPath(pts);
        const gid = `lg-${si}-${React.useId?'':''}`;
        return (
          <g key={si}>
            {area && (
              <path d={`${path} L ${pts[pts.length-1][0]} ${H-padB} L ${pts[0][0]} ${H-padB} Z`}
                fill={s.color} fillOpacity="0.08"
                style={{ opacity:on?1:0, transition:`opacity .7s ease ${0.25+si*0.1}s` }} />
            )}
            <path d={path} stroke={s.color} strokeWidth={strokeW} strokeLinecap="round" vectorEffect="non-scaling-stroke"
              style={{ strokeDasharray:1600, strokeDashoffset:on?0:1600, transition:`stroke-dashoffset 1.3s var(--ease) ${si*0.12}s` }} />
            <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3.2" fill={s.color}
              style={{ opacity:on?1:0, transition:`opacity .3s ease ${1+si*0.1}s` }} />
          </g>
        );
      })}
      {labels && labels.map((l, i) => (
        <text key={i} x={X(i)} y={H - 6} fontSize="11" fill="var(--ink-3)" textAnchor="middle"
          style={{ fontFamily:'var(--font-ui)' }} vectorEffect="non-scaling-stroke">{l}</text>
      ))}
    </svg>
  );
}

/* ---------- Donut ---------- */
function Donut({ segments, size = 160, thickness = 20, gap = 3, centerTop, centerBig, centerSub }) {
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0);
  const on = useMounted();
  let acc = 0;
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} stroke="var(--surface-sunken)" strokeWidth={thickness} fill="none" />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const len = Math.max(0, frac * circ - gap);
          const off = acc * circ;
          acc += frac;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} stroke={s.color} strokeWidth={thickness} fill="none"
              strokeLinecap="round"
              strokeDasharray={`${on ? len : 0} ${circ}`} strokeDashoffset={-off}
              style={{ transition:`stroke-dasharray 1s var(--ease) ${0.15 + i*0.12}s` }} />
          );
        })}
      </svg>
      {(centerBig || centerTop) && (
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', textAlign:'center' }}>
          <div>
            {centerTop && <div className="eyebrow" style={{ marginBottom:2 }}>{centerTop}</div>}
            {centerBig && <div className="metric-num" style={{ fontSize:size*0.22 }}>{centerBig}</div>}
            {centerSub && <div className="faint" style={{ fontSize:12, marginTop:2 }}>{centerSub}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Ring (single value gauge) ---------- */
function Ring({ value, size = 92, thickness = 9, color = 'var(--accent)', label }) {
  const r = (size - thickness) / 2, cx = size/2, circ = 2*Math.PI*r;
  const on = useMounted();
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={cx} cy={cx} r={r} stroke="var(--surface-sunken)" strokeWidth={thickness} fill="none" />
        <circle cx={cx} cy={cx} r={r} stroke={color} strokeWidth={thickness} fill="none" strokeLinecap="round"
          strokeDasharray={`${on ? (value/100)*circ : 0} ${circ}`}
          style={{ transition:'stroke-dasharray 1s var(--ease) .2s' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', flexDirection:'column' }}>
        <div className="metric-num" style={{ fontSize:size*0.26 }}>{value}<span style={{ fontSize:size*0.14, color:'var(--ink-3)' }}>%</span></div>
      </div>
    </div>
  );
}

/* ---------- Horizontal bars (objection / theme shares) ---------- */
function HBars({ items, accent = 'var(--accent)', showTrend = false }) {
  const on = useMounted();
  const max = Math.max(...items.map(i => i.share));
  return (
    <div className="stack" style={{ gap:14 }}>
      {items.map((it, i) => (
        <div key={i} className="stack" style={{ gap:7 }}>
          <div className="row" style={{ justifyContent:'space-between', gap:10 }}>
            <span style={{ fontWeight:600, fontSize:13.5, color:'var(--ink)' }}>{it.t}</span>
            <span className="row" style={{ gap:8 }}>
              {showTrend && it.trend != null && <Delta value={it.trend} />}
              <span className="tnum" style={{ fontWeight:700, fontSize:13.5, color:'var(--ink)' }}>{it.share}%</span>
            </span>
          </div>
          <div className="bar" style={{ height:9 }}>
            <i style={{ width: on ? `${(it.share/max)*100}%` : '0%', background: it.color || accent, transitionDelay:`${i*0.08}s` }} />
          </div>
          {it.sample && <div className="faint" style={{ fontSize:12, fontStyle:'italic' }}>{it.sample}</div>}
        </div>
      ))}
    </div>
  );
}

/* ---------- Stacked area legend chip ---------- */
function Legend({ items }) {
  return (
    <div className="row wrap" style={{ gap:16 }}>
      {items.map((it, i) => (
        <span key={i} className="row" style={{ gap:7, fontSize:12.5, color:'var(--ink-2)', fontWeight:500 }}>
          <i style={{ width:10, height:10, borderRadius:3, background:it.color }} />{it.name}
        </span>
      ))}
    </div>
  );
}

/* ---------- Mood/emotion strip (calendar heat) ---------- */
function MoodStrip({ weeks = 12, seed = 5 }) {
  const cells = React.useMemo(() => {
    const out = []; let s = seed*7919;
    for (let i = 0; i < weeks*7; i++){ s=(s*9301+49297)%233280; out.push(s/233280); }
    return out;
  }, [weeks, seed]);
  const on = useMounted();
  const tone = v => v > 0.66 ? 'var(--good)' : v > 0.33 ? 'var(--viz-3)' : 'var(--viz-4)';
  const toneLabel = v => v > 0.66 ? 'Calm' : v > 0.33 ? 'Mixed' : 'Tense';
  const total = weeks*7;
  const dayMs = 86400000;
  const dateFor = (i) => { const d = new Date(Date.now() - (total-1-i)*dayMs); return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }); };
  const [tip, setTip] = React.useState(null);
  return (
    <div style={{ position:'relative' }}>
      {tip && (
        <div style={{ position:'absolute', left:tip.x, top:-8, transform:'translate(-50%,-100%)', zIndex:5, pointerEvents:'none',
          background:'var(--ink)', color:'var(--paper)', padding:'6px 9px', borderRadius:8, fontSize:11.5, fontWeight:600, whiteSpace:'nowrap', boxShadow:'var(--shadow-2)' }}>
          {tip.date} · {tip.mood}
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${weeks},1fr)`, gap:4 }}
        onMouseLeave={()=>setTip(null)}>
        {Array.from({length:weeks}).map((_, w) => (
          <div key={w} className="stack" style={{ gap:4 }}>
            {Array.from({length:7}).map((_, d) => {
              const idx = w*7+d; const v = cells[idx];
              return <i key={d} title={`${dateFor(idx)} · ${toneLabel(v)}`}
                onMouseEnter={()=>setTip({ x:`${(w+0.5)/weeks*100}%`, date:dateFor(idx), mood:toneLabel(v) })}
                style={{ aspectRatio:'1', borderRadius:3, background:tone(v), opacity:on?0.35+0.65*v:0, cursor:'pointer', transition:`opacity .5s ease ${idx*0.004}s, transform .12s`, outline:tip&&tip.date===dateFor(idx)?'2px solid var(--ink)':'none' }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted });


export { Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted };
