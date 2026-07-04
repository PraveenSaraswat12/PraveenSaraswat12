// Web reference ingestion: fetch a public URL, extract tables + readable text.
import type { DataSource, DataTable, ParseOutcome, Row, Cell } from '../../contracts/types';
import { gridToTable } from '../profile';
import { uid } from '../util';
import { jsonToTables, makeTable, parseCSVText } from './files';

/** swap-able for tests */
export let webFetch: typeof fetch = (...args) => fetch(...args);
export function __setWebFetchForTests(f: typeof fetch) { webFetch = f; }

const PROXIES = [
  (u: string) => u,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

export async function parseWebUrl(url: string): Promise<ParseOutcome> {
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) {
    return { sources: [], tables: [], warnings: [{ sourceName: url, message: 'Enter a full link starting with https://' }] };
  }
  let lastErr = '';
  for (const wrap of PROXIES) {
    try {
      const res = await webFetch(wrap(clean), { headers: { Accept: 'text/html,application/json,text/csv,*/*' } });
      if (!res.ok) { lastErr = `HTTP ${res.status}`; continue; }
      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      const body = await res.text();
      return interpret(clean, ctype, body);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return {
    sources: [], tables: [],
    warnings: [{ sourceName: clean, message: `Could not reach this link (${lastErr}). If it needs a login, export the data as a file instead.` }],
  };
}

function interpret(url: string, ctype: string, body: string): ParseOutcome {
  const src: DataSource = {
    id: uid('s'), name: hostName(url), kind: 'web',
    addedAt: new Date().toISOString(), sizeBytes: body.length, tableIds: [],
    meta: { url },
  };
  const trimmed = body.trim();
  // JSON (by header or shape)
  if (ctype.includes('json') || /^[[{]/.test(trimmed)) {
    try {
      const data = JSON.parse(trimmed);
      const tables = jsonToTables(data, src.name, src.id);
      src.tableIds = tables.map((t) => t.id);
      if (!tables.length) src.textContent = trimmed.slice(0, 20000);
      return { sources: [src], tables, warnings: [] };
    } catch { /* fall through */ }
  }
  // CSV
  if (ctype.includes('csv') || looksLikeCSV(trimmed)) {
    const t = parseCSVText(trimmed, src.name, src.id);
    if (t) { src.tableIds = [t.id]; return { sources: [src], tables: [t], warnings: [] }; }
  }
  // HTML
  if (ctype.includes('html') || /<\s*html|<\s*table/i.test(body)) {
    return parseHTML(src, body);
  }
  // plain text fallback
  src.textContent = trimmed.slice(0, 20000);
  return { sources: [src], tables: [], warnings: [] };
}

function looksLikeCSV(s: string): boolean {
  const lines = s.split('\n', 5).filter(Boolean);
  if (lines.length < 2) return false;
  const counts = lines.map((l) => (l.match(/,/g) || []).length);
  return counts[0] >= 1 && counts.every((c) => c === counts[0]);
}

function hostName(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.split('/').filter(Boolean).pop() || '';
    return path ? `${u.hostname} · ${decodeURIComponent(path).slice(0, 40)}` : u.hostname;
  } catch { return url.slice(0, 50); }
}

function parseHTML(src: DataSource, html: string): ParseOutcome {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = doc.querySelector('title')?.textContent?.trim();
  if (title) src.name = title.slice(0, 60);
  const tables: DataTable[] = [];
  doc.querySelectorAll('table').forEach((tbl, i) => {
    const grid: Cell[][] = [];
    tbl.querySelectorAll('tr').forEach((tr) => {
      const cells: Cell[] = [];
      tr.querySelectorAll('th,td').forEach((td) => {
        const span = Math.min(Number(td.getAttribute('colspan') || 1), 8);
        const text = (td.textContent || '').replace(/\s+/g, ' ').trim();
        cells.push(text);
        for (let s = 1; s < span; s++) cells.push(null);
      });
      if (cells.some((c) => c !== null && c !== '')) grid.push(cells);
    });
    if (grid.length >= 2) {
      const caption = tbl.querySelector('caption')?.textContent?.trim();
      const g = gridToTable(grid);
      const t = makeTable(caption || `Table ${i + 1}`, src.id, g.columns, g.rows as Row[]);
      if (t && t.columns.length >= 2) tables.push(t);
    }
  });
  // readable text
  doc.querySelectorAll('script,style,noscript,nav,header,footer,iframe,svg').forEach((n) => n.remove());
  const text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  if (text) src.textContent = text.slice(0, 20000);
  src.tableIds = tables.map((t) => t.id);
  const warnings = tables.length ? [] : [{
    sourceName: src.name,
    message: 'No tables found on the page — kept the page text as context for the AI.',
  }];
  return { sources: [src], tables, warnings };
}
