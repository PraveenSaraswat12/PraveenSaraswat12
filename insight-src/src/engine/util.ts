// Shared engine utilities: ids, number/date parsing, formatting.
import type { Cell } from '../contracts/types';

let uidCounter = 0;
export function uid(prefix = 'k'): string {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const CURRENCY_RE = /[₹$€£]/;
const NUM_CLEAN_RE = /[,\s₹$€£%]/g;

export interface NumParse { value: number; currency?: string; percent?: boolean; }

/** parse "₹1,23,456.78", "(500)", "45%", "1 200" … */
export function parseNumberLoose(v: Cell): NumParse | null {
  if (typeof v === 'number') return Number.isFinite(v) ? { value: v } : null;
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (!s || s.length > 24) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  const currency = CURRENCY_RE.exec(s)?.[0];
  const percent = s.endsWith('%');
  s = s.replace(NUM_CLEAN_RE, '');
  if (!s || !/^[+-]?\d*\.?\d+(e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return { value: neg ? -n : n, currency, percent };
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export interface DateParse { iso: string; ms: number; hasTime: boolean; }

function mk(y: number, m: number, d: number, hh = 0, mm = 0): DateParse | null {
  if (y < 1900 || y > 2200 || m < 0 || m > 11 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m, d, hh, mm));
  if (dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const hasTime = hh !== 0 || mm !== 0;
  const iso = `${y}-${pad(m + 1)}-${pad(d)}${hasTime ? ` ${pad(hh)}:${pad(mm)}` : ''}`;
  return { iso, ms: dt.getTime(), hasTime };
}

/**
 * Parse one date string. dayFirst resolves dd/mm vs mm/dd ambiguity
 * (decided per column by the profiler; default true — India-first).
 */
export function parseDateLoose(v: Cell, dayFirst = true): DateParse | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 40) return null;

  // ISO: 2024-03-05[T10:30] / 2024/03/05
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(s);
  if (m) return mk(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);

  // dd/mm/yyyy or mm/dd/yyyy (also - and .)
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(s);
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3];
    if (y < 100) y += y < 50 ? 2000 : 1900;
    let d = dayFirst ? a : b;
    let mo = dayFirst ? b : a;
    if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; } // self-correcting
    return mk(y, mo - 1, d, m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  }

  // 5-Mar-2024 / 05 Mar 24 / Mar 5, 2024 / 5 March 2024
  m = /^(\d{1,2})[ -]([A-Za-z]{3,9})[ -,]+(\d{2,4})$/.exec(s);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo === undefined) return null;
    let y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900;
    return mk(y, mo, +m[1]);
  }
  m = /^([A-Za-z]{3,9})[ .]+(\d{1,2})(?:st|nd|rd|th)?[ ,]+(\d{2,4})$/.exec(s);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo === undefined) return null;
    let y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900;
    return mk(y, mo, +m[2]);
  }
  // 2024-03 (month) → first of month
  m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (m) return mk(+m[1], +m[2] - 1, 1);
  return null;
}

/** Excel serial date (days since 1899-12-30) → DateParse */
export function excelSerialToDate(n: number): DateParse | null {
  if (!Number.isFinite(n) || n < 20000 || n > 73050) return null; // ~1954..2099
  const ms = Math.round((n - 25569) * 86400000);
  const dt = new Date(ms);
  return mk(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(),
    dt.getUTCHours(), dt.getUTCMinutes());
}

export function isoToMs(iso: string): number {
  // 'yyyy-MM-dd' or 'yyyy-MM-dd HH:mm'
  const d = parseDateLoose(iso, true);
  return d ? d.ms : NaN;
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface FmtOpts { decimals?: number; currency?: string; percent?: boolean; }

/** 4214567 → "4.2M" · with currency "₹4.2M" · percent → "34.5%" */
export function fmtNum(v: number | null | undefined, opts: FmtOpts = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (opts.percent) return `${round(v, opts.decimals ?? 1)}%`;
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  let body: string;
  if (a >= 1e9) body = `${round(a / 1e9, 1)}B`;
  else if (a >= 1e6) body = `${round(a / 1e6, 1)}M`;
  else if (a >= 1e4) body = `${round(a / 1e3, 1)}K`;
  else body = String(round(a, opts.decimals ?? (a < 10 && a % 1 !== 0 ? 2 : 0)));
  return `${sign}${opts.currency ?? ''}${body}`;
}

export function round(v: number, d = 1): number {
  const p = 10 ** d;
  return Math.round(v * p) / p;
}

export function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** normalize for fuzzy matching: lowercase alphanumerics only */
export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return dp[b.length];
}

/** simple deterministic PRNG for sample data / stable ids in tests */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
