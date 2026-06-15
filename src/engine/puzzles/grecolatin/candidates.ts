import { decodePair } from './rules';

export interface Analysis {
  aRow: Set<number>[]; aCol: Set<number>[];
  bRow: Set<number>[]; bCol: Set<number>[];
  pairs: Set<number>;
}

/** Per-row/col used symbols (both projections) + globally-used pairs for a (partial) grid. */
export function analyze(n: number, grid: number[]): Analysis {
  const mk = () => Array.from({ length: n }, () => new Set<number>());
  const a: Analysis = { aRow: mk(), aCol: mk(), bRow: mk(), bCol: mk(), pairs: new Set<number>() };
  for (let i = 0; i < n * n; i++) {
    if (grid[i] === 0) continue;
    const p = decodePair(grid[i], n)!;
    const r = Math.floor(i / n), c = i % n;
    a.aRow[r].add(p.a); a.aCol[c].add(p.a); a.bRow[r].add(p.b); a.bCol[c].add(p.b);
    a.pairs.add(p.a * n + p.b);
  }
  return a;
}

/** All (a,b) pairs consistent with row/col Latin constraints + global pair-distinctness at cell `i`. */
export function candidatesAt(n: number, an: Analysis, i: number): { a: number; b: number }[] {
  const r = Math.floor(i / n), c = i % n;
  const out: { a: number; b: number }[] = [];
  for (let a = 0; a < n; a++) {
    if (an.aRow[r].has(a) || an.aCol[c].has(a)) continue;
    for (let b = 0; b < n; b++) {
      if (an.bRow[r].has(b) || an.bCol[c].has(b)) continue;
      if (an.pairs.has(a * n + b)) continue;
      out.push({ a, b });
    }
  }
  return out;
}
