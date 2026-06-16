import { analyze, candidatesAt } from './candidates';
import type { GrecoLatinInstance, GrecoLatinState } from './types';
import type { Hint } from '../../core/types';

/** Merge clues + player state into knownA/knownB (clue wins; player value otherwise; null = open). */
function knownFrom(inst: GrecoLatinInstance, cells: number[]): { knownA: (number | null)[]; knownB: (number | null)[] } {
  const n = inst.n;
  const knownA: (number | null)[] = [];
  const knownB: (number | null)[] = [];
  for (let i = 0; i < n * n; i++) {
    const v = cells[i] || 0;
    const pa = v !== 0 ? Math.floor((v - 1) / n) : null;
    const pb = v !== 0 ? (v - 1) % n : null;
    knownA[i] = inst.digitClues[i] !== null ? inst.digitClues[i] : pa;
    knownB[i] = inst.letterClues[i] !== null ? inst.letterClues[i] : pb;
  }
  return { knownA, knownB };
}

/** MRV completion (bounded) of the open dimensions; returns full knownA/knownB or null. */
function complete(n: number, knownA: (number | null)[], knownB: (number | null)[]): { a: number[]; b: number[] } | null {
  const A = [...knownA], B = [...knownB];
  let steps = 0;
  const CAP = 8_000;
  const rec = (): boolean => {
    if (++steps > CAP) return false;
    const an = analyze(n, A, B);
    let target = -1;
    let best: { a: number; b: number }[] | null = null;
    for (let i = 0; i < n * n; i++) {
      if (A[i] !== null && B[i] !== null) continue;
      const cands = candidatesAt(n, an, A, B, i);
      if (cands.length === 0) return false;
      if (best === null || cands.length < best.length) { target = i; best = cands; if (cands.length === 1) break; }
    }
    if (target === -1) return true;
    for (const c of best!) {
      const savedA = A[target], savedB = B[target];
      A[target] = c.a; B[target] = c.b;
      if (rec()) return true;
      A[target] = savedA; B[target] = savedB;
    }
    return false;
  };
  return rec() ? { a: A as number[], b: B as number[] } : null;
}

/** Suggest a cell + the dimension(s) to fill: a forced dimension if any, else a value from a completion. */
export function hintCell(inst: GrecoLatinInstance, cells: number[]): { index: number; a: number | null; b: number | null } | null {
  const n = inst.n;
  const { knownA, knownB } = knownFrom(inst, cells);
  const an = analyze(n, knownA, knownB);
  let firstOpen = -1;
  for (let i = 0; i < n * n; i++) {
    if (knownA[i] !== null && knownB[i] !== null) continue;
    if (firstOpen < 0) firstOpen = i;
    const cands = candidatesAt(n, an, knownA, knownB, i);
    if (cands.length === 0) continue;
    if (knownA[i] === null && cands.every((c) => c.a === cands[0].a)) return { index: i, a: cands[0].a, b: null };
    if (knownB[i] === null && cands.every((c) => c.b === cands[0].b)) return { index: i, a: null, b: cands[0].b };
  }
  if (firstOpen < 0) return null;
  const done = complete(n, knownA, knownB);
  if (!done) return null;
  return {
    index: firstOpen,
    a: knownA[firstOpen] === null ? done.a[firstOpen] : null,
    b: knownB[firstOpen] === null ? done.b[firstOpen] : null
  };
}

export function getHint(inst: GrecoLatinInstance, state: GrecoLatinState): Hint | null {
  const r = hintCell(inst, state.cells);
  if (!r) return null;
  const parts: string[] = [];
  if (r.b !== null) parts.push(`letter ${String.fromCharCode(65 + r.b)}`);
  if (r.a !== null) parts.push(`digit ${r.a + 1}`);
  return { cells: [r.index], text: `Place ${parts.join(', ')}` };
}
