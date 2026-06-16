import { decodePair, encodePair } from './rules';
import { analyze, candidatesAt } from './candidates';
import type { GrecoLatinInstance, GrecoLatinState } from './types';
import type { Hint } from '../../core/types';

/**
 * MRV backtracking completion of the empty cells, bounded by a step cap so a hint
 * can never freeze the UI (even at large orders / very sparse grids). Always expands
 * the empty cell with the fewest candidates (forced singles first). Returns a
 * completed grid, or null if none is found within the cap.
 */
function complete(n: number, grid: number[]): number[] | null {
  const work = [...grid];
  let steps = 0;
  const CAP = 1_000_000;
  const rec = (): boolean => {
    if (++steps > CAP) return false;
    const an = analyze(n, work);
    let target = -1;
    let bestCands: { a: number; b: number }[] | null = null;
    for (let i = 0; i < n * n; i++) {
      if (work[i] !== 0) continue;
      const cands = candidatesAt(n, an, i);
      if (cands.length === 0) return false; // dead end → backtrack
      if (bestCands === null || cands.length < bestCands.length) {
        target = i;
        bestCands = cands;
        if (cands.length === 1) break; // forced — cannot do better than 1 candidate
      }
    }
    if (target === -1) return true; // no empties left → solved
    for (const c of bestCands!) {
      work[target] = encodePair(c.a, c.b, n);
      if (rec()) return true;
      work[target] = 0;
    }
    return false;
  };
  return rec() ? work : null;
}

/** Suggest a cell + encoded pair: a forced single if any, else a value from a valid completion. */
export function hintCell(inst: GrecoLatinInstance, cells: number[]): { index: number; value: number } | null {
  const n = inst.n;
  const grid = inst.givens.map((g, i) => (g !== 0 ? g : cells[i] || 0));
  const an = analyze(n, grid);
  let firstEmpty = -1;
  for (let i = 0; i < n * n; i++) {
    if (grid[i] !== 0) continue;
    if (firstEmpty < 0) firstEmpty = i;
    const cands = candidatesAt(n, an, i);
    if (cands.length === 1) return { index: i, value: encodePair(cands[0].a, cands[0].b, n) };
  }
  if (firstEmpty < 0) return null;
  const completed = complete(n, grid);
  return completed ? { index: firstEmpty, value: completed[firstEmpty] } : null;
}

export function getHint(inst: GrecoLatinInstance, state: GrecoLatinState): Hint | null {
  const r = hintCell(inst, state.cells);
  if (!r) return null;
  const p = decodePair(r.value, inst.n)!;
  return { cells: [r.index], text: `Place letter ${String.fromCharCode(65 + p.b)}, digit ${p.a + 1}` };
}
