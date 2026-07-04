// Column profiling: header detection, type inference, coercion, stats.
import type { Cell, ColumnProfile, ColumnType, Row } from '../contracts/types';
import { excelSerialToDate, parseDateLoose, parseNumberLoose } from './util';

const NULLISH = new Set(['', 'n/a', 'na', 'null', 'none', '-', '--', 'nil', '#n/a']);
const BOOL_TRUE = new Set(['true', 'yes', 'y', '1']);
const BOOL_FALSE = new Set(['false', 'no', 'n', '0']);
const DATE_NAME_RE = /date|day|time|created|updated|due|dob|month|_on$| on$|timestamp/i;
const ID_NAME_RE = /(^|[_ ])(id|code|key|no|num|number|ref|sku|pin)s?$|^(id|uuid)/i;

export function isNullish(v: Cell): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return NULLISH.has(v.trim().toLowerCase());
  return false;
}

interface GridResult { columns: string[]; rows: Row[]; }

/** header:1 style grid → named columns + data rows */
export function gridToTable(grid: Cell[][]): GridResult {
  // drop fully empty rows, trim trailing empty columns
  const rows = grid.filter((r) => r && r.some((c) => !isNullish(c)));
  if (rows.length === 0) return { columns: [], rows: [] };
  let width = 0;
  for (const r of rows) {
    for (let i = r.length - 1; i >= 0; i--) {
      if (!isNullish(r[i])) { width = Math.max(width, i + 1); break; }
    }
  }
  const first = rows[0].slice(0, width);
  const firstAllStrings = first.every(
    (c) => typeof c === 'string' && c.trim() !== '' && !parseNumberLoose(c)
  );
  // header if first row is all labels, or labels distinct from the rows below
  const second = rows[1]?.slice(0, width);
  const secondLooksData = second
    ? second.some((c) => typeof c === 'number' || (typeof c === 'string' && !!parseNumberLoose(c)))
    : false;
  const hasHeader = rows.length > 1 && firstAllStrings && (secondLooksData || true);
  const rawNames = hasHeader
    ? first.map((c, i) => (isNullish(c) ? `Column ${i + 1}` : String(c).trim()))
    : first.map((_, i) => `Column ${i + 1}`);
  // dedupe
  const seen = new Map<string, number>();
  const columns = rawNames.map((n) => {
    const k = n.toLowerCase();
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    return c === 1 ? n : `${n} (${c})`;
  });
  const dataRows = (hasHeader ? rows.slice(1) : rows).map((r) => {
    const out: Row = new Array(width).fill(null);
    for (let i = 0; i < width; i++) out[i] = isNullish(r[i]) ? null : r[i];
    return out;
  });
  return { columns, rows: dataRows };
}

interface TypeScan {
  type: ColumnType;
  dayFirst: boolean;
  excelSerial: boolean;
  currency?: string;
}

function scanType(name: string, values: Cell[]): TypeScan {
  let nNum = 0, nDate = 0, nBool = 0, nStr = 0, total = 0;
  let dayEvidence = 0, monthEvidence = 0;
  let serialCandidates = 0;
  let currency: string | undefined;
  const uniq = new Set<string>();
  for (const v of values) {
    if (isNullish(v)) continue;
    total++;
    if (typeof v === 'boolean') { nBool++; uniq.add(String(v)); continue; }
    const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
    if (s && (BOOL_TRUE.has(s) || BOOL_FALSE.has(s))) { nBool++; uniq.add(s); continue; }
    const d = typeof v === 'string' ? parseDateLoose(v, true) : null;
    if (d) {
      nDate++;
      const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/.exec(String(v).trim());
      if (m) {
        if (+m[1] > 12) dayEvidence++;
        if (+m[2] > 12) monthEvidence++;
      }
      continue;
    }
    const n = parseNumberLoose(v);
    if (n) {
      nNum++;
      if (n.currency) currency = n.currency;
      if (Number.isInteger(n.value) && n.value >= 20000 && n.value <= 73050) serialCandidates++;
      continue;
    }
    nStr++;
    if (uniq.size <= 64) uniq.add(String(v));
  }
  if (total === 0) return { type: 'empty', dayFirst: true, excelSerial: false };
  const share = (n: number) => n / total;
  // 0/1 columns: only boolean when exactly the 0/1 pair and name doesn't look numeric
  const boolish = share(nBool + (uniq.has('0') || uniq.has('1') ? 0 : 0)) >= 0.99 && uniq.size <= 2;
  if (boolish && nBool === total) return { type: 'boolean', dayFirst: true, excelSerial: false };
  if (share(nDate) >= 0.8) {
    return { type: 'date', dayFirst: dayEvidence >= monthEvidence, excelSerial: false };
  }
  if (share(nNum) >= 0.8) {
    const excelSerial = DATE_NAME_RE.test(name) && serialCandidates / total >= 0.8;
    return { type: excelSerial ? 'date' : 'number', dayFirst: true, excelSerial, currency };
  }
  if (share(nStr) >= 0.8) return { type: 'string', dayFirst: true, excelSerial: false };
  return { type: 'mixed', dayFirst: dayEvidence >= monthEvidence, excelSerial: false, currency };
}

export interface ProfiledTable { columns: string[]; rows: Row[]; profiles: ColumnProfile[]; }

/** profile + coerce a named grid in one pass */
export function profileTable(columns: string[], rowsIn: Row[]): ProfiledTable {
  const rows = rowsIn.map((r) => r.slice());
  const profiles: ColumnProfile[] = columns.map((name, ci) => {
    const raw = rows.map((r) => r[ci]);
    const scan = scanType(name, raw);
    // coerce
    let nonNull = 0;
    const nums: number[] = [];
    const counts = new Map<string, number>();
    let minD: string | undefined, maxD: string | undefined;
    for (let ri = 0; ri < rows.length; ri++) {
      let v = rows[ri][ci];
      if (isNullish(v)) { rows[ri][ci] = null; continue; }
      if (scan.type === 'number') {
        const n = parseNumberLoose(v);
        v = n ? n.value : v;
      } else if (scan.type === 'date') {
        if (scan.excelSerial) {
          const n = parseNumberLoose(v);
          const d = n ? excelSerialToDate(n.value) : null;
          v = d ? d.iso : v;
        } else {
          const d = typeof v === 'string' ? parseDateLoose(v, scan.dayFirst) : null;
          v = d ? d.iso : v;
        }
      } else if (scan.type === 'boolean') {
        const s = String(v).trim().toLowerCase();
        v = typeof v === 'boolean' ? v : BOOL_TRUE.has(s);
      } else if (typeof v === 'string') {
        v = v.trim();
      }
      rows[ri][ci] = v as Cell;
      nonNull++;
      if (typeof v === 'number') nums.push(v);
      if (scan.type === 'date' && typeof v === 'string') {
        if (!minD || v < minD) minD = v;
        if (!maxD || v > maxD) maxD = v;
      }
      const key = String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const uniqueCount = counts.size;
    const nullCount = rows.length - nonNull;
    let min: number | string | undefined, max: number | string | undefined;
    let mean: number | undefined, median: number | undefined, sum: number | undefined, stdDev: number | undefined;
    if (scan.type === 'number' && nums.length) {
      nums.sort((a, b) => a - b);
      min = nums[0]; max = nums[nums.length - 1];
      sum = nums.reduce((a, b) => a + b, 0);
      mean = sum / nums.length;
      median = nums[Math.floor((nums.length - 1) / 2)];
      const m = mean;
      stdDev = Math.sqrt(nums.reduce((a, b) => a + (b - m) ** 2, 0) / nums.length);
    } else if (scan.type === 'date') {
      min = minD; max = maxD;
    }
    const topValues = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value, count]) => ({ value, count }));
    const uniqueRatio = nonNull ? uniqueCount / nonNull : 0;
    const isYearCol = scan.type === 'number' && nums.length > 0 &&
      nums[0] >= 1990 && nums[nums.length - 1] <= 2100 &&
      nums.every((n) => Number.isInteger(n)) && uniqueCount <= 30;
    const isId =
      uniqueRatio >= 0.95 && nonNull >= 5 &&
      (ID_NAME_RE.test(name) || scan.type === 'string' || isSequential(nums));
    const isCategory =
      !isId &&
      ((scan.type === 'string' || scan.type === 'boolean') &&
        uniqueCount <= Math.max(20, rows.length * 0.05) && uniqueCount >= 1) ||
      isYearCol;
    const isDate = scan.type === 'date';
    const isMetric = scan.type === 'number' && !isId && !isYearCol;
    const examples = topValues.slice(0, 3).map((t) => t.value);
    return {
      name, type: scan.type, examples, nonNullCount: nonNull, nullCount,
      uniqueCount, min, max, mean, median, sum, stdDev,
      isId, isCategory, isDate, isMetric, topValues,
    };
  });
  return { columns, rows, profiles };
}

function isSequential(nums: number[]): boolean {
  if (nums.length < 5) return false;
  if (!nums.every((n) => Number.isInteger(n))) return false;
  const span = nums[nums.length - 1] - nums[0];
  return span > 0 && span <= nums.length * 3;
}
