// Cross-table relation detection: matching keys make the data "talk to each other".
import type { DataTable, Relation } from '../contracts/types';
import { levenshtein, norm, uid } from './util';

const STOP_SUFFIX = /(id|code|key|no|num|number|ref)$/;

function nameSimilarity(a: string, b: string): number {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // customer_id ↔ id ; cust_id ↔ customer_id
  const ca = na.replace(STOP_SUFFIX, ''), cb = nb.replace(STOP_SUFFIX, '');
  if (na.endsWith(nb) || nb.endsWith(na)) return 0.85;
  if (ca && cb && (ca.includes(cb) || cb.includes(ca))) return 0.7;
  if (levenshtein(na, nb, 2) <= 2) return 0.6;
  return 0;
}

function distinctSample(t: DataTable, ci: number, cap = 5000): Set<string> {
  const s = new Set<string>();
  for (const r of t.rows) {
    const v = r[ci];
    if (v === null) continue;
    s.add(String(v).toLowerCase());
    if (s.size >= cap) break;
  }
  return s;
}

export function detectRelations(tables: DataTable[]): Relation[] {
  const rels: Relation[] = [];
  for (let i = 0; i < tables.length; i++) {
    for (let j = 0; j < tables.length; j++) {
      if (i === j) continue;
      const A = tables[i], B = tables[j];
      let bestPerColumn = new Map<string, Relation>();
      for (let ai = 0; ai < A.columns.length; ai++) {
        const pa = A.profiles[ai];
        if (pa.type === 'empty' || pa.isMetric || pa.isDate) continue;
        for (let bi = 0; bi < B.columns.length; bi++) {
          const pb = B.profiles[bi];
          if (pb.type === 'empty' || pb.isMetric || pb.isDate) continue;
          const nameSim = nameSimilarity(A.columns[ai], B.columns[bi]);
          const idish = (pa.isId ? 0.5 : 0) + (pb.isId ? 0.5 : 0);
          if (nameSim < 0.6 && idish < 0.5) continue; // cheap pre-filter
          const sa = distinctSample(A, ai);
          if (sa.size < 2) continue;
          const sb = distinctSample(B, bi);
          if (sb.size < 2) continue;
          let inter = 0;
          for (const v of sa) if (sb.has(v)) inter++;
          const matchRate = inter / sa.size;
          if (matchRate < 0.3) continue;
          const confidence = Math.min(1, 0.5 * matchRate + 0.3 * nameSim + 0.2 * (idish >= 0.5 ? 1 : 0));
          if (confidence < 0.5) continue;
          const aUnique = pa.uniqueCount >= pa.nonNullCount * 0.98;
          const bUnique = pb.uniqueCount >= pb.nonNullCount * 0.98;
          const kind = aUnique && bUnique ? 'one-to-one'
            : !aUnique && bUnique ? 'many-to-one'
            : aUnique && !bUnique ? 'one-to-many'
            : 'many-to-many';
          const rel: Relation = {
            id: uid('r'),
            fromTableId: A.id, fromColumn: A.columns[ai],
            toTableId: B.id, toColumn: B.columns[bi],
            kind, confidence: Math.round(confidence * 100) / 100,
            matchRate: Math.round(matchRate * 100) / 100,
          };
          const key = A.columns[ai];
          const prev = bestPerColumn.get(key);
          if (!prev || rel.confidence > prev.confidence) bestPerColumn.set(key, rel);
        }
      }
      rels.push(...bestPerColumn.values());
    }
  }
  // de-duplicate mirrored pairs (keep the many-to-one direction first)
  const seen = new Set<string>();
  return rels.filter((r) => {
    const k1 = `${r.fromTableId}.${r.fromColumn}→${r.toTableId}.${r.toColumn}`;
    const k2 = `${r.toTableId}.${r.toColumn}→${r.fromTableId}.${r.fromColumn}`;
    if (seen.has(k2) || seen.has(k1)) return false;
    seen.add(k1);
    return true;
  });
}
