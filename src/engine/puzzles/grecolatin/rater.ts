import { analyze, candidatesAt } from './candidates';
import type { GrecoLatinInstance } from './types';
import type { Difficulty } from '../../core/types';

/**
 * Fraction of originally-unknown DIMENSIONS still unforced after propagating forced
 * singles per dimension. A dimension (a or b of a cell) is "unknown" when its clue is
 * null. Propagation fixes a dimension when every legal pair at that cell shares one
 * value for it (a-Latin / b-Latin completion + pair-distinctness coupling, all sound:
 * each derived exclusion holds in every valid completion). Re-`analyze` after each fix.
 * 0 = fully deducible (easy); 1 = nothing forced (hard).
 */
export function residualFreeRatio(inst: GrecoLatinInstance): number {
  const n = inst.n;
  const knownA = [...inst.digitClues];
  const knownB = [...inst.letterClues];
  const initialUnknown = countUnknownDims(knownA, knownB);
  if (initialUnknown === 0) return 0;
  let changed = true;
  while (changed) {
    changed = false;
    const an = analyze(n, knownA, knownB);
    for (let i = 0; i < n * n; i++) {
      if (knownA[i] !== null && knownB[i] !== null) continue;
      const cands = candidatesAt(n, an, knownA, knownB, i);
      if (cands.length === 0) continue; // unsatisfiable locally (won't happen on real-square clues)
      if (knownA[i] === null && allSame(cands.map((c) => c.a))) { knownA[i] = cands[0].a; changed = true; break; }
      if (knownB[i] === null && allSame(cands.map((c) => c.b))) { knownB[i] = cands[0].b; changed = true; break; }
    }
  }
  return countUnknownDims(knownA, knownB) / initialUnknown;
}

function countUnknownDims(knownA: (number | null)[], knownB: (number | null)[]): number {
  let count = 0;
  for (let i = 0; i < knownA.length; i++) {
    if (knownA[i] === null) count++;
    if (knownB[i] === null) count++;
  }
  return count;
}

function allSame(xs: number[]): boolean {
  return xs.length > 0 && xs.every((x) => x === xs[0]);
}

// Cut points calibrated against the n=5 partial-clue residual distribution (2026-06-16).
// Partial clues populate a genuinely-hard region (~0.85), so `hard` is now reachable —
// the win. But at n=5 the medium and hard medians both land ~0.85 and do NOT separate
// cleanly, so `medium` stays squeezed and is served by closest-fallback (still honest:
// `generateForDifficulty` always reports the real `rate`). easy ≈ 0, expert ≈ 1. Larger
// orders (deferred) would separate medium/hard better.
function bandForRatio(r: number): Difficulty {
  if (r <= 0.05) return 'easy';
  if (r <= 0.73) return 'medium';
  if (r <= 0.97) return 'hard';
  return 'expert';
}

/** Rate a Greco-Latin instance by how much free-choice search its construction needs. */
export function rate(inst: GrecoLatinInstance): Difficulty {
  return bandForRatio(residualFreeRatio(inst));
}
