import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
import CATALOG, { CATS } from './books-data.js';
/* ============================================================
   KITHRA — Books: discover store + your library + in-app reader
   Public-domain titles read in-app (Premium). Summaries are a Plus
   feature. No copyrighted full text is bundled — those link out.
   ============================================================ */
const BTYPES = [
  { k:'book', label:'Book' }, { k:'research', label:'Research' }, { k:'framework', label:'Framework' },
  { k:'practice', label:'Practice' }, { k:'practitioner', label:'Practitioner' },
];
const BTYPE_ICON = { book:'book', research:'layers', framework:'target', practice:'leaf', practitioner:'stethoscope' };
const COVERS = ['var(--viz-1)','var(--viz-2)','var(--viz-3)','var(--viz-4)','var(--viz-5)','var(--accent)'];
function coverFor(b){ if (b.color) return b.color; const s = String(b.title||''); let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return COVERS[h % COVERS.length]; }
const enc = encodeURIComponent;
function links(b){ const q = enc(`${b.title} ${b.author||''}`); return { borrow:`https://openlibrary.org/search?q=${q}`, preview:`https://www.google.com/search?tbm=bks&q=${q}`, buy:`https://www.amazon.com/s?k=${q}` }; }
function coverNode(b, w=46, h=60, icon=20){ return (
  <span className="center" style={{ width:w, height:h, borderRadius:8, background:coverFor(b), color:'#fff', flex:'none', boxShadow:'var(--shadow-1)', position:'relative', overflow:'hidden' }}>
    <Icon name={b.read?'book':(BTYPE_ICON[b.type]||'book')} size={icon} />
  </span>
); }

/* ---------- in-app reader (public-domain full text) ---------- */
function Reader({ book, onBack }) {
  const [text, setText] = React.useState('');
  const [state, setState] = React.useState('loading'); // loading | ready | error
  const [fs, setFs] = React.useState(() => { try { return Number(localStorage.getItem('kithra_read_fs')) || 18; } catch(e){ return 18; } });
  const [pct, setPct] = React.useState(0);
  const scRef = React.useRef(null);
  const pkey = 'kithra_read_' + book.id;
  React.useEffect(() => {
    let on = true; setState('loading');
    (async () => {
      try {
        const res = await fetch(book.read);
        if (!res.ok) throw new Error('fetch');
        const t = await res.text();
        if (!on) return;
        setText(t); setState('ready');
        setTimeout(() => { const sc = scRef.current; if (sc) { let saved = 0; try { saved = Number(localStorage.getItem(pkey)) || 0; } catch(e){} sc.scrollTop = saved * (sc.scrollHeight - sc.clientHeight); } }, 60);
      } catch (e) { if (on) setState('error'); }
    })();
    return () => { on = false; };
  }, [book.id]);
  React.useEffect(() => { try { localStorage.setItem('kithra_read_fs', String(fs)); } catch(e){} }, [fs]);
  const onScroll = () => { const sc = scRef.current; if (!sc) return; const max = sc.scrollHeight - sc.clientHeight; const p = max > 0 ? sc.scrollTop / max : 0; setPct(p); try { localStorage.setItem(pkey, String(p)); } catch(e){} };
  return (
    <div className="page" style={{ maxWidth:820, margin:'0 auto' }}>
      <div className="row" style={{ gap:12, marginBottom:14, alignItems:'center', flexWrap:'wrap' }}>
        <button className="btn btn-icon btn-ghost" onClick={onBack} aria-label="Back to books"><Icon name="chevL" size={18} /></button>
        <div className="stack grow" style={{ gap:2, minWidth:0 }}>
          <span className="eyebrow">Reading · public domain</span>
          <h1 className="display" style={{ fontSize:22, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{book.title}</h1>
        </div>
        <div className="row" style={{ gap:6, flex:'none' }}>
          <button className="btn btn-soft btn-sm btn-icon" aria-label="Smaller text" onClick={()=>setFs(f=>Math.max(13,f-1))}>A−</button>
          <button className="btn btn-soft btn-sm btn-icon" aria-label="Larger text" onClick={()=>setFs(f=>Math.min(28,f+1))}>A+</button>
        </div>
      </div>
      <div className="bar" style={{ height:5, marginBottom:12 }}><i style={{ width:`${Math.round(pct*100)}%`, transition:'width .1s linear' }} /></div>
      {state==='loading' && <div className="card card-pad center" style={{ minHeight:200 }}><div className="stack center" style={{ gap:12 }}><LiveWave bars={20} height={30} /><span className="faint">Loading the book…</span></div></div>}
      {state==='error' && <div className="card card-pad center" style={{ minHeight:200 }}><div className="stack center" style={{ gap:12 }}><Icon name="x" size={26} /><span className="muted" style={{ textAlign:'center', maxWidth:340 }}>Couldn’t load this text right now. It needs an internet connection the first time.</span></div></div>}
      {state==='ready' && (
        <div ref={scRef} onScroll={onScroll} className="card scroll" style={{ padding:'30px clamp(20px,5vw,56px)', maxHeight:'calc(100vh - 230px)', overflow:'auto', background:'var(--paper)' }}>
          <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:'var(--font-display)', fontSize:fs, lineHeight:1.75, color:'var(--ink)', margin:0 }}>{text}</pre>
        </div>
      )}
    </div>
  );
}

/* ---------- book detail (summary + ideas + actions, gated) ---------- */
function BookDetail({ book, onClose, onRead, owned, onToggleOwn, planAllows, go, showToast }) {
  const L = links(book);
  const canSummary = planAllows('plus');
  const canRead = planAllows('premium');
  return (
    <div className="lc-overlay" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="lc-card card scroll" style={{ width:'min(560px,94vw)', maxHeight:'90vh', overflow:'auto' }}>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:14 }}>
          <span className="badge badge-neutral" style={{ height:24 }}>{book.cat}</span>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="row" style={{ gap:16, alignItems:'flex-start', marginBottom:16 }}>
          {coverNode(book, 64, 86, 26)}
          <div className="stack grow" style={{ gap:4, minWidth:0 }}>
            <h2 className="display" style={{ fontSize:22, margin:0, lineHeight:1.2 }}>{book.title}</h2>
            <span className="muted" style={{ fontSize:14 }}>{book.author}{book.year?` · ${book.year<0?(-book.year+' BCE'):book.year}`:''}</span>
            <div className="row" style={{ gap:6, marginTop:4, flexWrap:'wrap' }}>
              {book.read && <Badge kind="good" dot>Readable in app</Badge>}
              {!book.read && <span className="tag" style={{ height:22 }}><Icon name="link" size={11} />Borrow / buy</span>}
            </div>
          </div>
        </div>

        {/* summary + ideas (Plus) */}
        {canSummary ? (
          <div className="stack" style={{ gap:14, marginBottom:16 }}>
            <div><span className="eyebrow" style={{ display:'block', marginBottom:6 }}>Summary</span><p className="muted" style={{ margin:0, fontSize:14, lineHeight:1.6 }}>{book.summary}</p></div>
            {book.ideas && <div><span className="eyebrow" style={{ display:'block', marginBottom:8 }}>Key ideas</span>
              <div className="stack" style={{ gap:8 }}>{book.ideas.map((it,i)=>(
                <div key={i} className="row" style={{ gap:10, alignItems:'flex-start' }}><span className="center" style={{ width:22, height:22, borderRadius:7, background:'var(--accent-soft)', color:'var(--accent-strong)', flex:'none', fontSize:11, fontWeight:700 }}>{i+1}</span><span style={{ fontSize:13.5, lineHeight:1.5 }}>{it}</span></div>
              ))}</div></div>}
          </div>
        ) : (
          <div className="card card-pad" style={{ background:'var(--accent-soft)', border:'1px solid color-mix(in srgb,var(--accent) 22%,transparent)', marginBottom:16 }}>
            <div className="row" style={{ gap:10, marginBottom:6 }}><Icon name="spark" size={18} fill style={{ color:'var(--accent-strong)' }} /><span style={{ fontWeight:700, fontSize:14.5 }}>Summaries &amp; key ideas are a Plus feature</span></div>
            <p className="muted" style={{ margin:'0 0 12px', fontSize:13.5, lineHeight:1.55 }}>Unlock crisp summaries and the key ideas for all {CATALOG.length}+ books with Plus.</p>
            <button className="btn btn-primary btn-sm" onClick={()=>{ onClose(); go('pricing'); }}><Icon name="spark" size={14} fill />See Plus</button>
          </div>
        )}

        {/* actions */}
        <div className="stack" style={{ gap:10 }}>
          {book.read && (
            canRead
              ? <button className="btn btn-primary btn-lg" onClick={()=>onRead(book)}><Icon name="book" size={18} />Read in app</button>
              : <button className="btn btn-lg" style={{ background:'var(--viz-5)', color:'#fff' }} onClick={()=>{ onClose(); go('pricing'); }}><Icon name="lock" size={16} />Read in app — Premium</button>
          )}
          <div className="row" style={{ gap:8, flexWrap:'wrap' }}>
            <a className="btn btn-soft btn-sm" href={L.borrow} target="_blank" rel="noopener noreferrer"><Icon name="book" size={14} />Borrow (Open Library)</a>
            <a className="btn btn-soft btn-sm" href={L.preview} target="_blank" rel="noopener noreferrer"><Icon name="eye" size={14} />Preview</a>
            <a className="btn btn-soft btn-sm" href={L.buy} target="_blank" rel="noopener noreferrer"><Icon name="arrowUR" size={14} />Buy</a>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf:'flex-start' }} onClick={()=>{ onToggleOwn(book); }}>
            <Icon name={owned?'check':'plus'} size={15} />{owned?'In your library':'Add to your library'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Books() {
  const { books, addBook, removeBook, planAllows, plan, go, showToast } = useApp();
  const [tab, setTab] = React.useState('discover'); // discover | mine
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState('all');
  const [detail, setDetail] = React.useState(null);
  const [reading, setReading] = React.useState(null);

  const ownedIds = new Set((books||[]).map(b=>b.id));
  const toggleOwn = (b) => {
    if (ownedIds.has(b.id)) { removeBook(b.id); showToast('Removed from your library','trash'); }
    else { addBook({ id:b.id, title:b.title, author:b.author, type:b.type||'book', notes:(b.summary||'') }); showToast('Added to your library','book'); }
  };
  const openRead = (b) => { if (!planAllows('premium')) { go('pricing'); return; } setDetail(null); setReading(b); };

  if (reading) return <Reader book={reading} onBack={()=>setReading(null)} />;

  const source = tab==='discover' ? CATALOG : (books||[]);
  const catOpts = [{value:'all',label:'All categories'}, ...CATS.map(c=>({ value:c, label:c }))];
  const filtered = source.filter(b =>
    (cat==='all' || b.cat===cat) &&
    (!q || `${b.title} ${b.author||''} ${b.summary||b.notes||''}`.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="page">
      <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-end', marginBottom:16, flexWrap:'wrap', gap:14 }}>
        <div className="stack" style={{ gap:6 }}>
          <span className="eyebrow">Knowledge · grounding</span>
          <h1 className="display" style={{ fontSize:28, margin:0 }}>Books</h1>
        </div>
        <div className="seg">
          <button className={tab==='discover'?'on':''} onClick={()=>setTab('discover')}>Discover</button>
          <button className={tab==='mine'?'on':''} onClick={()=>setTab('mine')}>My library</button>
        </div>
      </div>

      <p className="muted" style={{ margin:'0 0 var(--gap)', fontSize:14.5, maxWidth:680, lineHeight:1.55 }}>
        A growing library of <strong>{CATALOG.length}+ books</strong> on communication, persuasion, leadership and the mind — the thinking Kithra’s insights are grounded in. Read summaries &amp; key ideas with <strong>Plus</strong>; read the full public-domain classics in-app with <strong>Premium</strong>.
      </p>

      <div className="lib-toolbar" style={{ marginBottom:'var(--gap)' }}>
        <div className="searchbox" style={{ flex:'1 1 220px', height:38 }}>
          <Icon name="search" size={16} /><input value={q} onChange={e=>setQ(e.target.value)} placeholder={tab==='discover'?'Search 100+ books…':'Search your library…'} />
        </div>
        <Dropdown icon="filter" label="Category" value={cat} options={catOpts} onChange={setCat} />
        <span className="badge badge-neutral" style={{ height:38 }}><Icon name="book" size={13} />{tab==='discover'?`${CATALOG.length}+ in store`:`${(books||[]).length} saved`}</span>
      </div>

      {filtered.length===0 ? (
        <div className="card center" style={{ padding:'56px 20px' }}>
          <div className="stack center" style={{ gap:12, maxWidth:360, textAlign:'center' }}>
            <span className="center" style={{ width:52, height:52, borderRadius:16, background:'var(--surface-sunken)', color:'var(--ink-3)' }}><Icon name="book" size={24} /></span>
            <span style={{ fontWeight:700, fontSize:15 }}>{tab==='mine' && (books||[]).length===0 ? 'Your library is empty' : 'No matches'}</span>
            <span className="muted" style={{ fontSize:13, lineHeight:1.5 }}>{tab==='mine' ? 'Add books from Discover, or your own references.' : 'Try a different search or category.'}</span>
            {tab==='mine' && <button className="btn btn-primary btn-sm" onClick={()=>setTab('discover')}><Icon name="book" size={14} />Browse the store</button>}
          </div>
        </div>
      ) : (
        <div className="grid g-3">
          {filtered.map(b=>{
            const owned = ownedIds.has(b.id);
            return (
              <button key={b.id} className="card card-pad stack click" style={{ gap:12, textAlign:'left', alignItems:'stretch' }} onClick={()=>setDetail(b)}>
                <div className="row" style={{ gap:12, alignItems:'flex-start' }}>
                  {coverNode(b)}
                  <div className="stack grow" style={{ gap:3, minWidth:0 }}>
                    <span style={{ fontWeight:700, fontSize:14.5, lineHeight:1.25 }}>{b.title}</span>
                    {b.author && <span className="faint" style={{ fontSize:12.5 }}>{b.author}</span>}
                    <div className="row" style={{ gap:6, marginTop:3, flexWrap:'wrap' }}>
                      <span className="tag" style={{ height:20, fontSize:10.5 }}>{b.cat || 'Book'}</span>
                      {b.read && <span className="tag" style={{ height:20, fontSize:10.5, color:'var(--good)', borderColor:'color-mix(in srgb,var(--good) 35%,transparent)' }}><Icon name="book" size={10} />Read free</span>}
                    </div>
                  </div>
                </div>
                {(b.summary||b.notes) && <p className="faint" style={{ margin:0, fontSize:12.5, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{planAllows('plus') ? (b.summary||b.notes) : 'Summary & key ideas with Plus →'}</p>}
                {owned && <span className="faint" style={{ fontSize:11.5, color:'var(--good)' }}><Icon name="check" size={11} stroke={2.6} /> In your library</span>}
              </button>
            );
          })}
        </div>
      )}

      {detail && <BookDetail book={detail} onClose={()=>setDetail(null)} onRead={openRead}
        owned={ownedIds.has(detail.id)} onToggleOwn={toggleOwn} planAllows={planAllows} go={go} showToast={showToast} />}
    </div>
  );
}

Object.assign(window, { Books });

export { Books };
