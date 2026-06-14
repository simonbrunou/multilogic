import { describe, it, expect } from 'vitest';
import { solveComplete, fill } from '../../../../src/engine/puzzles/tectonic/solver';
import { kingNeighbors, cellsByRegion } from '../../../../src/engine/puzzles/tectonic/rules';
import { createPrng } from '../../../../src/engine/core/prng';
import type { TectonicInstance } from '../../../../src/engine/puzzles/tectonic/types';

// A 1x5 strip: one region of size 5 (digits 1..5), king adjacency is horizontal only.
// Any permutation of 1..5 is valid (all distinct ⇒ adjacent differ), so it's always solvable.
const strip: TectonicInstance = { width: 5, height: 1, regions: [0, 0, 0, 0, 0], givens: [0, 0, 0, 0, 0] };

function valid(inst: TectonicInstance, sol: number[]): boolean {
  for (const cells of Object.values(cellsByRegion(inst.regions))) {
    const vals = cells.map((i) => sol[i]).sort((a, b) => a - b);
    if (vals.join() !== cells.map((_, k) => k + 1).join()) return false;
  }
  for (let i = 0; i < sol.length; i++) {
    for (const n of kingNeighbors(i, inst.width, inst.height)) if (sol[i] === sol[n]) return false;
  }
  return true;
}

describe('tectonic solver', () => {
  it('fill produces a valid complete solution deterministically', () => {
    const a = fill(strip, createPrng('t1'));
    const b = fill(strip, createPrng('t1'));
    expect(a).not.toBeNull();
    expect(valid(strip, a!)).toBe(true);
    expect(a).toEqual(b);
  });

  it('a fully-given valid grid has exactly one solution', () => {
    const sol = fill(strip, createPrng('seed'))!;
    expect(solveComplete({ ...strip, givens: sol }, 2).count).toBe(1);
  });

  it('counts multiple solutions up to the limit', () => {
    expect(solveComplete(strip, 2).count).toBe(2);
  });

  it('enforces constraints: an over-constrained 2x2 split has no solution', () => {
    // Two horizontal dominoes each need {1,2}; every bottom cell is king-adjacent to both
    // top cells (which hold 1 and 2), so no valid completion exists.
    const inst: TectonicInstance = { width: 2, height: 2, regions: [0, 0, 1, 1], givens: [0, 0, 0, 0] };
    expect(solveComplete(inst, 2).count).toBe(0);
  });
});
