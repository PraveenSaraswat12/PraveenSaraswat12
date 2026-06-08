import React from 'react';
import { Icon, LumenMark, Wordmark, Waveform, LiveWave, waveHeights, Avatar, Badge, Delta, SentDot, StatusPill, PrivacyChip, Dropdown, EvidenceList, Sparkline, LineChart, Donut, Ring, HBars, Legend, MoodStrip, smoothPath, useMounted, AppContext, useApp, ROUTES, useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton } from './kit.js';
/* ============================================================
   KITHRA — Books library (the knowledge that grounds insights)
   ============================================================ */
const BTYPES = [
  { k:'book', label:'Book' },
  { k:'research', label:'Research' },
  { k:'framework', label:'Framework' },
  { k:'practice', label:'Practice' },
  { k:'practitioner', label:'Practitioner' },
];
const BTYPE_ICON = { book:'book', research:'layers', framework:'target', practice:'leaf', practitioner:'stethoscope' };
const COVERS = ['var(--viz-1)','var(--viz-2)','var(--viz-3)','var(--viz-4)','var(--viz-5)','var(--accent)'];
function coverFor(b){ if (b.color) return b.color; const s = String(b.title||''); let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return COVERS[h % COVERS.length]; }
const typeLabel = (k) => (BTYPES.find(t=>t.k===k)||{}).label || 'Book';

function BookModal({ initial, onClose, onSave }) {
  const [title, setTitle] = React.useState(initial?.title || '');
  const [author, setAuthor] = React.useState(initial?.author || '');
  const [type, setType] = React.useState(initial?.type || 'book');
  const [notes, setNotes] = React.useState(initial?.notes || '');
  const can = title.trim().length > 0;
  return (
    <div className="lc-overlay" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="lc-card card" style={{ width:'min(480px,94vw)' }}>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:6 }}>
          <span className="badge badge-accent" style={{ height:26 }}><Icon name="book" size={13} />{initial?'Edit book':'Add a book'}</span>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <h2 className="display" style={{ fontSize:22, margin:'6px 0 14px' }}>{initial?'Edit book':'Add to your library'}</h2>
        <div className="stack" style={{ gap:12 }}>
          <label className="stack" style={{ gap:5 }}><span className="eyebrow">Title</span>
            <input className="field" style={{ height:40 }} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Never Split the Difference" autoFocus /></label>
          <label className="stack" style={{ gap:5 }}><span className="eyebrow">Author</span>
            <input className="field" style={{ height:40 }} value={author} onChange={e=>setAuthor(e.target.value)} placeholder="e.g. Chris Voss" /></label>
          <label className="stack" style={{ gap:5 }}><span className="eyebrow">Type</span>
            <select className="field" style={{ height:40 }} value={type} onChange={e=>setType(e.target.value)}>
              {BTYPES.map(t=><option key={t.k} value={t.k}>{t.label}</option>)}
            </select></label>
          <label className="stack" style={{ gap:5 }}><span className="eyebrow">Key ideas / notes</span>
            <textarea className="field" style={{ minHeight:84, padding:'10px 12px', resize:'vertical', lineHeight:1.5 }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What should Kithra draw on from this book?" /></label>
        </div>
        <div className="row" style={{ gap:10, marginTop:16 }}>
          <button className="btn btn-ghost btn-lg grow" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-lg grow" disabled={!can} onClick={()=>onSave({ title:title.trim(), author:author.trim(), type, notes:notes.trim() })}><Icon name="check" size={17} />{initial?'Save changes':'Add book'}</button>
        </div>
      </div>
    </div>
  );
}

function Books() {
  const { books, addBook, updateBook, removeBook, showToast } = useApp();
  const [q, setQ] = React.useState('');
  const [type, setType] = React.useState('all');
  const [modal, setModal] = React.useState(null); // null | {} (add) | book (edit)
  const filtered = (books || []).filter(b =>
    (type==='all' || b.type===type) &&
    (!q || `${b.title} ${b.author||''} ${b.notes||''}`.toLowerCase().includes(q.toLowerCase()))
  );
  const typeOpts = [{value:'all',label:'All types'}, ...BTYPES.map(t=>({ value:t.k, label:t.label }))];
  return (
    <div className="page">
      <div className="row" style={{ justifyContent:'space-between', alignItems:'flex-end', marginBottom:18, flexWrap:'wrap', gap:14 }}>
        <div className="stack" style={{ gap:6 }}>
          <span className="eyebrow">Knowledge · grounding</span>
          <h1 className="display" style={{ fontSize:28, margin:0 }}>Books</h1>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal({})}><Icon name="plus" size={16} />Add book</button>
      </div>

      <p className="muted" style={{ margin:'0 0 var(--gap)', fontSize:14.5, maxWidth:640, lineHeight:1.55 }}>
        The books, frameworks and practices in your library are what Kithra’s insights are <strong>grounded in</strong> — so suggestions reflect proven thinking, not guesswork. They appear under “Informed by your library” on your analyses. Your library is saved on this device.
      </p>

      <div className="lib-toolbar" style={{ marginBottom:'var(--gap)' }}>
        <div className="searchbox" style={{ flex:'1 1 220px', height:38 }}>
          <Icon name="search" size={16} /><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search your library…" />
        </div>
        <Dropdown icon="filter" label="Type" value={type} options={typeOpts} onChange={setType} />
        <span className="badge badge-neutral" style={{ height:38 }}><Icon name="book" size={13} />{(books||[]).length} in library</span>
      </div>

      {filtered.length===0 ? (
        <div className="card center" style={{ padding:'56px 20px' }}>
          <div className="stack center" style={{ gap:12, maxWidth:360, textAlign:'center' }}>
            <span className="center" style={{ width:52, height:52, borderRadius:16, background:'var(--surface-sunken)', color:'var(--ink-3)' }}><Icon name="book" size={24} /></span>
            <span style={{ fontWeight:700, fontSize:15 }}>{(books||[]).length ? 'No matches' : 'Your library is empty'}</span>
            <span className="muted" style={{ fontSize:13, lineHeight:1.5 }}>Add the books, frameworks and practices you want Kithra to draw on.</span>
            <button className="btn btn-primary btn-sm" onClick={()=>setModal({})}><Icon name="plus" size={14} />Add your first book</button>
          </div>
        </div>
      ) : (
        <div className="grid g-3">
          {filtered.map(b=>(
            <div key={b.id} className="card card-pad stack" style={{ gap:12 }}>
              <div className="row" style={{ gap:12, alignItems:'flex-start' }}>
                <span className="center" style={{ width:46, height:60, borderRadius:8, background:coverFor(b), color:'#fff', flex:'none', boxShadow:'var(--shadow-1)' }}><Icon name={BTYPE_ICON[b.type]||'book'} size={20} /></span>
                <div className="stack grow" style={{ gap:3, minWidth:0 }}>
                  <span style={{ fontWeight:700, fontSize:14.5, lineHeight:1.25 }}>{b.title}</span>
                  {b.author && <span className="faint" style={{ fontSize:12.5 }}>{b.author}</span>}
                  <span className="tag" style={{ height:20, fontSize:10.5, marginTop:2, width:'fit-content' }}>{typeLabel(b.type)}</span>
                </div>
              </div>
              {b.notes && <p className="faint" style={{ margin:0, fontSize:12.5, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{b.notes}</p>}
              <div className="row" style={{ gap:6, marginTop:'auto' }}>
                <button className="btn btn-soft btn-sm" onClick={()=>setModal(b)}><Icon name="settings" size={14} />Edit</button>
                <button className="btn btn-soft btn-sm btn-icon" aria-label="Remove book" onClick={()=>{ removeBook(b.id); showToast('Removed from library','trash'); }}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <BookModal initial={modal.id?modal:null}
        onClose={()=>setModal(null)}
        onSave={(data)=>{ if(modal.id){ updateBook(modal.id, data); showToast('Book updated','check'); } else { addBook(data); showToast('Added to your library','book'); } setModal(null); }} />}
    </div>
  );
}

Object.assign(window, { Books });

export { Books };
