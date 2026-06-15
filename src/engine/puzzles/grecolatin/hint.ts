import { decodePair, encodePair } from './rules';
import { analyze, candidatesAt } from './candidates';
import type { GrecoLatinInstance, GrecoLatinState } from './types';
import type { Hint } from '../../core/types';

/** Backtracking completion of the empty cells; returns a completed grid or null. */
function complete(n: number, grid: number[]): number[] | null {
  const work = [...grid];
  const empties = work.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  const ok = (i: number, a: number, b: number): boolean => {
    const r = Math.floor(i / n), c = i % n;
    for (let k = 0; k < n; k++) {
      const rr = r * n + k, cc = k * n + c;
      if (work[rr] !== 0) { const p = decodePair(work[rr], n)!; if (p.a === a || p.b === b) return false; }
      if (work[cc] !== 0) { const p = decodePair(work[cc], n)!; if (p.a === a || p.b === b) return false; }
    }
    for (let j = 0; j < n * n; j++) { if (work[j] !== 0) { const p = decodePair(work[j], n)!; if (p.a === a && p.b === b) return false; } }
    return true;
  };
  const rec = (k: number): boolean => {
    if (k === empties.length) return true;
    const i = empties[k];
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      if (ok(i, a, b)) { work[i] = encodePair(a, b, n); if (rec(k + 1)) return true; work[i] = 0; }
    }
    return false;
  };
  return rec(0) ? work : null;
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
