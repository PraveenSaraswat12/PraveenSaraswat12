// File ingestion: Excel, CSV, JSON, PDF, code/text → tables + context text.
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type {
  Cell, DataSource, DataTable, ParseOutcome, ParseWarning, Row, SourceKind,
} from '../../contracts/types';
import { gridToTable, isNullish, profileTable } from '../profile';
import { uid } from '../util';
import { loadPdfJs } from './cdn';

const TEXT_CAP = 20000;

export function makeTable(name: string, sourceId: string, columns: string[], rows: Row[]): DataTable | null {
  if (!columns.length || !rows.length) return null;
  const p = profileTable(columns, rows);
  return {
    id: uid('t'), name, sourceId,
    columns: p.columns, rows: p.rows, profiles: p.profiles, rowCount: p.rows.length,
  };
}

function mkSource(name: string, kind: SourceKind, sizeBytes: number): DataSource {
  return { id: uid('s'), name, kind, addedAt: new Date().toISOString(), sizeBytes, tableIds: [] };
}

export async function parseFiles(files: File[]): Promise<ParseOutcome> {
  const out: ParseOutcome = { sources: [], tables: [], warnings: [] };
  for (const f of files) {
    try {
      const one = await parseOne(f);
      out.sources.push(...one.sources);
      out.tables.push(...one.tables);
      out.warnings.push(...one.warnings);
    } catch (e) {
      out.warnings.push({ sourceName: f.name, message: `Could not read this file: ${msg(e)}` });
    }
  }
  return out;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

async function parseOne(f: File): Promise<ParseOutcome> {
  const e = ext(f.name);
  if (e === 'xlsx' || e === 'xls' || e === 'xlsm' || e === 'ods') return parseExcel(f);
  if (e === 'csv' || e === 'tsv') return parseCSV(f);
  if (e === 'json') return parseJSONFile(f);
  if (e === 'pdf' || f.type === 'application/pdf') return parsePDF(f);
  // everything else (txt/md/code/logs) goes through the text pipeline
  return parseTextLike(f);
}

// ── Excel ────────────────────────────────────────────────────────────────────

async function parseExcel(f: File): Promise<ParseOutcome> {
  const buf = await f.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const src = mkSource(f.name, 'excel', f.size);
  const tables: DataTable[] = [];
  const warnings: ParseWarning[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const grid = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null });
    const g = gridToTable(grid as Cell[][]);
    const t = makeTable(sheetName, src.id, g.columns, g.rows);
    if (t) tables.push(t);
  }
  if (!tables.length) warnings.push({ sourceName: f.name, message: 'No data rows found in any sheet.' });
  src.tableIds = tables.map((t) => t.id);
  return { sources: [src], tables, warnings };
}

// ── CSV / TSV ────────────────────────────────────────────────────────────────

export function parseCSVText(text: string, name: string, sourceId: string): DataTable | null {
  const res = Papa.parse<Cell[]>(text, { skipEmptyLines: 'greedy' });
  const grid = (res.data as Cell[][]).filter((r) => Array.isArray(r));
  const g = gridToTable(grid);
  return makeTable(name.replace(/\.(csv|tsv)$/i, ''), sourceId, g.columns, g.rows);
}

async function parseCSV(f: File): Promise<ParseOutcome> {
  const text = await f.text();
  const src = mkSource(f.name, 'csv', f.size);
  const t = parseCSVText(text, f.name, src.id);
  if (!t) return { sources: [src], tables: [], warnings: [{ sourceName: f.name, message: 'No rows found.' }] };
  src.tableIds = [t.id];
  return { sources: [src], tables: [t], warnings: [] };
}

// ── JSON ─────────────────────────────────────────────────────────────────────

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, Cell> {
  const out: Record<string, Cell> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) out[key] = null;
    else if (typeof v === 'object' && !Array.isArray(v) && !prefix) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    } else if (typeof v === 'object') out[key] = JSON.stringify(v);
    else out[key] = v as Cell;
  }
  return out;
}

export function jsonToTables(data: unknown, name: string, sourceId: string): DataTable[] {
  const tables: DataTable[] = [];
  const addArray = (arr: unknown[], tname: string) => {
    const objs = arr.filter((x) => x && typeof x === 'object' && !Array.isArray(x)) as Record<string, unknown>[];
    if (objs.length < Math.max(1, arr.length * 0.8)) return;
    const flat = objs.map((o) => flatten(o));
    const cols: string[] = [];
    for (const r of flat) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
    const rows: Row[] = flat.map((r) => cols.map((c) => (r[c] === undefined ? null : r[c])));
    const t = makeTable(tname, sourceId, cols, rows);
    if (t) tables.push(t);
  };
  if (Array.isArray(data)) addArray(data, name);
  else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (Array.isArray(v) && v.length) addArray(v, k);
    }
    if (!tables.length) {
      // single object → one-row table
      const flat = flatten(data as Record<string, unknown>);
      const cols = Object.keys(flat);
      if (cols.length) {
        const t = makeTable(name, sourceId, cols, [cols.map((c) => flat[c])]);
        if (t) tables.push(t);
      }
    }
  }
  return tables;
}

async function parseJSONFile(f: File): Promise<ParseOutcome> {
  const text = await f.text();
  const src = mkSource(f.name, 'json', f.size);
  let data: unknown;
  try { data = JSON.parse(text); } catch {
    src.textContent = text.slice(0, TEXT_CAP);
    return { sources: [src], tables: [], warnings: [{ sourceName: f.name, message: 'Not valid JSON — kept as text context.' }] };
  }
  const tables = jsonToTables(data, f.name.replace(/\.json$/i, ''), src.id);
  src.tableIds = tables.map((t) => t.id);
  if (!tables.length) src.textContent = text.slice(0, TEXT_CAP);
  return { sources: [src], tables, warnings: [] };
}

// ── code / text: extract embedded structures ────────────────────────────────

const CODE_EXT = new Set(['js', 'ts', 'jsx', 'tsx', 'py', 'sql', 'html', 'xml', 'yml', 'yaml', 'java', 'c', 'cpp', 'cs', 'rb', 'go', 'rs', 'php', 'sh', 'r']);

export function extractFromText(text: string, name: string, sourceId: string): { tables: DataTable[]; rest: string } {
  const tables: DataTable[] = [];
  let rest = text;

  // markdown tables
  const mdRe = /(?:^|\n)((?:\|[^\n]*\|\s*\n){2,})/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = mdRe.exec(text))) {
    const lines = m[1].trim().split('\n').map((l) => l.trim()).filter(Boolean);
    const cells = lines
      .filter((l) => !/^\|[\s:|-]+\|$/.test(l))
      .map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim() as Cell));
    if (cells.length >= 2) {
      const g = gridToTable(cells);
      const t = makeTable(`${name} table ${++idx}`, sourceId, g.columns, g.rows);
      if (t) { tables.push(t); rest = rest.replace(m[1], '\n'); }
    }
  }

  // JSON array literals
  const jsonRe = /\[\s*\{[\s\S]{20,200000}?\}\s*\]/g;
  while ((m = jsonRe.exec(text))) {
    try {
      const data = JSON.parse(m[0]);
      const ts = jsonToTables(data, `${name} data ${++idx}`, sourceId);
      if (ts.length) { tables.push(...ts); rest = rest.replace(m[0], ' '); }
    } catch { /* not JSON — skip */ }
  }

  // SQL INSERT INTO t (a,b) VALUES (1,2),(3,4)
  const sqlRe = /insert\s+into\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)\s*values\s*((?:\([^)]*\)\s*,?\s*)+)/gi;
  while ((m = sqlRe.exec(text))) {
    const cols = m[2].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
    const valRe = /\(([^)]*)\)/g;
    const rows: Row[] = [];
    let vm: RegExpExecArray | null;
    while ((vm = valRe.exec(m[3]))) {
      rows.push(splitSqlRow(vm[1], cols.length));
    }
    const t = makeTable(m[1], sourceId, cols, rows);
    if (t) { tables.push(t); rest = rest.replace(m[0], ' '); }
  }

  // CSV-ish blocks: ≥3 consecutive lines, same comma/tab count ≥2
  if (!tables.length) {
    const lines = text.split('\n');
    let start = -1, delim = '', count = 0;
    const flush = (end: number) => {
      if (start >= 0 && end - start >= 3) {
        const block = lines.slice(start, end).join('\n');
        const t = parseCSVText(block, `${name} block`, sourceId);
        if (t && t.columns.length >= 2) tables.push(t);
      }
      start = -1; delim = ''; count = 0;
    };
    for (let i = 0; i <= lines.length; i++) {
      const l = lines[i] ?? '';
      const commas = (l.match(/,/g) || []).length;
      const tabs = (l.match(/\t/g) || []).length;
      const d = tabs >= 2 ? '\t' : commas >= 2 ? ',' : '';
      const n = d === '\t' ? tabs : commas;
      if (d && (start < 0 || (d === delim && n === count))) {
        if (start < 0) { start = i; delim = d; count = n; }
      } else flush(i);
    }
  }
  return { tables, rest: rest.trim() };
}

function splitSqlRow(s: string, n: number): Row {
  const out: Row = [];
  let cur = '', inQ = false, q = '';
  for (const ch of s) {
    if (inQ) {
      if (ch === q) inQ = false; else cur += ch;
    } else if (ch === "'" || ch === '"') { inQ = true; q = ch; }
    else if (ch === ',') { out.push(finishSqlCell(cur)); cur = ''; }
    else cur += ch;
  }
  out.push(finishSqlCell(cur));
  while (out.length < n) out.push(null);
  return out.slice(0, n);
}

function finishSqlCell(s: string): Cell {
  const t = s.trim();
  if (!t || /^null$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && /^[+-]?\d*\.?\d+$/.test(t) ? n : t;
}

async function parseTextLike(f: File): Promise<ParseOutcome> {
  const text = await f.text();
  const e = ext(f.name);
  const kind: SourceKind = CODE_EXT.has(e) ? 'code' : 'text';
  const src = mkSource(f.name, kind, f.size);
  const { tables, rest } = extractFromText(text, f.name.replace(/\.\w+$/, ''), src.id);
  src.tableIds = tables.map((t) => t.id);
  if (rest) src.textContent = rest.slice(0, TEXT_CAP);
  const warnings: ParseWarning[] = [];
  if (!tables.length && !rest) warnings.push({ sourceName: f.name, message: 'File appears to be empty.' });
  return { sources: [src], tables, warnings };
}

// ── PDF ──────────────────────────────────────────────────────────────────────

interface PdfItem { str: string; x: number; y: number; }

export function itemsToLines(items: PdfItem[]): PdfItem[][] {
  const byY = new Map<number, PdfItem[]>();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const key = Math.round(it.y / 3) * 3; // cluster nearby baselines
    let line = byY.get(key);
    if (!line) { line = []; byY.set(key, line); }
    line.push(it);
  }
  return [...byY.entries()]
    .sort((a, b) => b[0] - a[0]) // PDF y grows upward
    .map(([, line]) => line.sort((a, b) => a.x - b.x));
}

/** consecutive lines with the same cell count (≥2) become a table */
export function linesToTables(lines: PdfItem[][], name: string, sourceId: string): { tables: DataTable[]; text: string } {
  const tables: DataTable[] = [];
  const textParts: string[] = [];
  let block: PdfItem[][] = [];
  const flush = () => {
    if (block.length >= 3) {
      const grid = block.map((l) => l.map((i) => i.str.trim() as Cell));
      const g = gridToTable(grid);
      const t = makeTable(`${name} p-table ${tables.length + 1}`, sourceId, g.columns, g.rows);
      if (t) { tables.push(t); block = []; return; }
    }
    for (const l of block) textParts.push(l.map((i) => i.str).join(' '));
    block = [];
  };
  for (const line of lines) {
    const cells = line.length;
    if (cells >= 2 && (block.length === 0 || Math.abs(block[block.length - 1].length - cells) <= 1)) {
      block.push(line);
    } else {
      flush();
      if (cells >= 2) block.push(line);
      else textParts.push(line.map((i) => i.str).join(' '));
    }
  }
  flush();
  return { tables, text: textParts.join('\n') };
}

async function parsePDF(f: File): Promise<ParseOutcome> {
  const src = mkSource(f.name, 'pdf', f.size);
  const warnings: ParseWarning[] = [];
  try {
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
    const tables: DataTable[] = [];
    const textAll: string[] = [];
    const maxPages = Math.min(doc.numPages, 50);
    for (let p = 1; p <= maxPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items: PdfItem[] = (tc.items as any[])
        .filter((i) => typeof i.str === 'string')
        .map((i) => ({ str: i.str, x: i.transform?.[4] ?? 0, y: i.transform?.[5] ?? 0 }));
      const lines = itemsToLines(items);
      const r = linesToTables(lines, `${f.name.replace(/\.pdf$/i, '')} p${p}`, src.id);
      tables.push(...r.tables);
      if (r.text) textAll.push(r.text);
    }
    if (doc.numPages > maxPages) {
      warnings.push({ sourceName: f.name, message: `Read first ${maxPages} of ${doc.numPages} pages.` });
    }
    src.tableIds = tables.map((t) => t.id);
    src.textContent = textAll.join('\n\n').slice(0, TEXT_CAP);
    if (!tables.length && !src.textContent) {
      warnings.push({ sourceName: f.name, message: 'No extractable text — the PDF may be scanned images.' });
    }
    return { sources: [src], tables, warnings };
  } catch (e) {
    warnings.push({ sourceName: f.name, message: `PDF reading failed: ${msg(e)}` });
    return { sources: [src], tables: [], warnings };
  }
}
