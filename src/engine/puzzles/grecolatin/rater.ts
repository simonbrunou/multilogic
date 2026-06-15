import { analyze, candidatesAt } from './candidates';
import { encodePair } from './rules';
import type { GrecoLatinInstance } from './types';
import type { Difficulty } from '../../core/types';

/**
 * Fraction of originally-empty cells that remain UNFORCED after propagating forced
 * singles (cells with exactly one consistent pair). 0 = fully deducible (trivial);
 * 1 = nothing forced, every empty cell needs a free choice (hard). A forced single is
 * the only legal pair for that cell, so placing it is sound for any valid completion.
 */
export function residualFreeRatio(inst: GrecoLatinInstance): number {
  const n = inst.n;
  const grid = [...inst.givens];
  const totalEmpty = grid.filter((v) => v === 0).length;
  if (totalEmpty === 0) return 0;
  let changed = true;
  while (changed) {
    changed = false;
    const an = analyze(n, grid);
    // The per-pass `an` snapshot is safe to place multiple forced singles against: two
    // empty cells in a valid partial GL square cannot share the same unique forced pair.
    for (let i = 0; i < n * n; i++) {
      if (grid[i] !== 0) continue;
      const cands = candidatesAt(n, an, i);
      if (cands.length === 1) {
        grid[i] = encodePair(cands[0].a, cands[0].b, n);
        changed = true;
      }
    }
  }
  return grid.filter((v) => v === 0).length / totalEmpty;
}

// Cut points calibrated (n=5, 80 seeds each) against the residual-ratio distribution
// at the generator's reveal fractions (easy 0.6 … expert 0.2).
//
// Calibration output (medians):
//   easy   rev=0.6  med=0.00  p90=0.00
//   medium rev=0.45 med=0.00  p90=0.93
//   hard   rev=0.3  med=0.94  p90=1.00
//   expert rev=0.2  med=1.00  p90=1.00
//
// At n=5 the distribution is bimodal (ratio ≈ 0 or ≈ 1) with no gradual middle.
// easy and medium are squeezed at ratio 0 (both medians = 0); hard and expert are
// squeezed near ratio 1 (medians 0.94 and 1.00). Cuts sit in the two natural gaps:
//   cut1 = 0.05  (easy med=0 vs medium p90=0.93  → gap below 0.05)
//   cut2 = 0.47  (medium med=0 vs hard med=0.94  → midpoint ≈ 0.47)
//   cut3 = 0.97  (hard med=0.94 vs expert med=1.00 → gap in [0.94,1.00])
// NOTE: easy/medium and hard/expert pairs are squeezed at n=5; larger orders will
// show better separation.
function bandForRatio(r: number): Difficulty {
  if (r <= 0.05) return 'easy';
  if (r <= 0.47) return 'medium';
  if (r <= 0.97) return 'hard';
  return 'expert';
}

/** Rate a Greco-Latin instance by how much free-choice search its construction needs. */
export function rate(inst: GrecoLatinInstance): Difficulty {
  return bandForRatio(residualFreeRatio(inst));
}
