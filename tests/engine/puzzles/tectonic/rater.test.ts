import { describe, it, expect } from 'vitest';
import { rate, solveWithTechniques } from '../../../../src/engine/puzzles/tectonic/rater';
import { fill } from '../../../../src/engine/puzzles/tectonic/solver';
import { generateRegions } from '../../../../src/engine/puzzles/tectonic/regions';
import { createPrng } from '../../../../src/engine/core/prng';
import { DIFFICULTIES } from '../../../../src/engine/core/types';
import type { TectonicInstance } from '../../../../src/engine/puzzles/tectonic/types';

/** Build a solvable, fully-given 5x5 tectonic by retrying layouts. */
function solvableFull(): TectonicInstance {
  for (let k = 0; k < 500; k++) {
    const regions = generateRegions(5, 5, createPrng(k));
    for (let fk = 0; fk < 10; fk++) {
      const sol = fill({ width: 5, height: 5, regions, givens: new Array(25).fill(0) }, createPrng(k * 1000 + fk));
      if (sol) return { width: 5, height: 5, regions, givens: sol };
    }
  }
  throw new Error('no solvable layout found in 5000 tries');
}

describe('tectonic rater', () => {
  it('a fully-given grid solves with techniques and rates a known band', () => {
    const inst = solvableFull();
    expect(solveWithTechniques(inst).solved).toBe(true);
    expect(DIFFICULTIES).toContain(rate(inst));
  });

  it('rate is deterministic', () => {
    const inst = solvableFull();
    expect(rate(inst)).toBe(rate(inst));
  });
});
