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

// Cut points are recalibrated in Task 6 against the partial-clue distribution. Phase-0
// found the populated region is ~0.5–0.97 (plus easy ≈0, expert ≈1); these starting
// cuts split it into medium/hard and are tuned by the calibration step.
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
