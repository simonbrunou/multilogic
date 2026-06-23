import { analyze, candidatesAt } from './candidates';
import type { GrecoLatinInstance, GrecoLatinSolution } from './types';
import type { SolveResult } from '../../core/types';

/**
 * Uniqueness oracle: count the Greco-Latin completions consistent with the clues,
 * capped at `limit`. `limit = 2` is the canonical uniqueness check (count === 1 ⇒ unique).
 *
 * Backtracking search over the most-constrained open cell. An "open" cell has at least
 * one unknown dimension; each branch assigns a full (a,b) pair drawn from the legal
 * candidates (row/col-Latin in both projections + globally-distinct pairs). This is the
 * authoritative completion count — the single-step rater (`residualFreeRatio`) only
 * estimates difficulty and must not be used to decide uniqueness.
 */
export function solveComplete(inst: GrecoLatinInstance, limit = 2): SolveResult<GrecoLatinSolution> {
  const n = inst.n;
  const knownA = [...inst.digitClues];
  const knownB = [...inst.letterClues];
  let count = 0;

  // Reject obviously-inconsistent givens up front. candidatesAt only prunes the
  // dimensions the search assigns, so a duplicate already present in the *clues*
  // (e.g. two given digits in one row) would otherwise force a full, fruitless tree
  // walk to prove zero solutions. This keeps the oracle fast and correct for any input.
  if (!givensConsistent(n, knownA, knownB)) return { count: 0, solution: null };

  const search = (): void => {
    if (count >= limit) return;
    const an = analyze(n, knownA, knownB);
    // Most-constrained open cell (fewest candidates) to keep the branching factor low.
    let bestIdx = -1;
    let bestCands: { a: number; b: number }[] | null = null;
    for (let i = 0; i < n * n; i++) {
      if (knownA[i] !== null && knownB[i] !== null) continue;
      const cands = candidatesAt(n, an, knownA, knownB, i);
      if (cands.length === 0) return; // dead end: no legal pair here
      if (bestCands === null || cands.length < bestCands.length) {
        bestIdx = i;
        bestCands = cands;
        if (cands.length === 1) break;
      }
    }
    if (bestIdx === -1) {
      count++; // every cell pinned in both dimensions → one complete square
      return;
    }
    const savedA = knownA[bestIdx];
    const savedB = knownB[bestIdx];
    for (const c of bestCands!) {
      knownA[bestIdx] = c.a;
      knownB[bestIdx] = c.b;
      search();
      if (count >= limit) break;
    }
    knownA[bestIdx] = savedA;
    knownB[bestIdx] = savedB;
  };

  search();
  return { count, solution: null };
}

/** True iff the given clues hold no row/col duplicate in either projection and no repeated
 *  fully-given pair — i.e. they could belong to some Greco-Latin square. */
function givensConsistent(n: number, knownA: (number | null)[], knownB: (number | null)[]): boolean {
  const dupInLine = (idxs: number[], known: (number | null)[]): boolean => {
    const seen = new Set<number>();
    for (const i of idxs) {
      const v = known[i];
      if (v === null) continue;
      if (seen.has(v)) return true;
      seen.add(v);
    }
    return false;
  };
  for (let r = 0; r < n; r++) {
    const row = Array.from({ length: n }, (_, c) => r * n + c);
    if (dupInLine(row, knownA) || dupInLine(row, knownB)) return false;
  }
  for (let c = 0; c < n; c++) {
    const col = Array.from({ length: n }, (_, r) => r * n + c);
    if (dupInLine(col, knownA) || dupInLine(col, knownB)) return false;
  }
  const pairs = new Set<number>();
  for (let i = 0; i < n * n; i++) {
    const a = knownA[i], b = knownB[i];
    if (a === null || b === null) continue;
    const key = a * n + b;
    if (pairs.has(key)) return false;
    pairs.add(key);
  }
  return true;
}
