export interface Analysis {
  aRow: Set<number>[]; aCol: Set<number>[];
  bRow: Set<number>[]; bCol: Set<number>[];
  pairs: Set<number>;
}

/** Per-row/col known a/b values + globally-used pairs (cells where BOTH dims are known). */
export function analyze(n: number, knownA: (number | null)[], knownB: (number | null)[]): Analysis {
  const mk = () => Array.from({ length: n }, () => new Set<number>());
  const an: Analysis = { aRow: mk(), aCol: mk(), bRow: mk(), bCol: mk(), pairs: new Set<number>() };
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    const a = knownA[i], b = knownB[i];
    if (a !== null) { an.aRow[r].add(a); an.aCol[c].add(a); }
    if (b !== null) { an.bRow[r].add(b); an.bCol[c].add(b); }
    if (a !== null && b !== null) an.pairs.add(a * n + b);
  }
  return an;
}

/** Legal (a,b) pairs at cell `i`: `a` fixed to knownA[i] if set else any not row/col-used;
 *  `b` likewise; pair not globally used. */
export function candidatesAt(
  n: number, an: Analysis, knownA: (number | null)[], knownB: (number | null)[], i: number
): { a: number; b: number }[] {
  const r = Math.floor(i / n), c = i % n;
  const aValues = knownA[i] !== null ? [knownA[i] as number] : range(n).filter((a) => !an.aRow[r].has(a) && !an.aCol[c].has(a));
  const bValues = knownB[i] !== null ? [knownB[i] as number] : range(n).filter((b) => !an.bRow[r].has(b) && !an.bCol[c].has(b));
  const out: { a: number; b: number }[] = [];
  for (const a of aValues) for (const b of bValues) {
    if (an.pairs.has(a * n + b)) continue;
    out.push({ a, b });
  }
  return out;
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, k) => k);
}
