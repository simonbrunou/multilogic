import { describe, it, expect } from 'vitest';
import { generateForDifficulty } from '../../../../src/engine/puzzles/tectonic/generator';
import { rate } from '../../../../src/engine/puzzles/tectonic/rater';
import { solveComplete } from '../../../../src/engine/puzzles/tectonic/solver';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import { DIFFICULTIES, type Difficulty } from '../../../../src/engine/core/types';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

describe('tectonic generateForDifficulty (dig-to-minimal + relax)', () => {
  // Generous timeouts: expert tectonic generation (dig-to-minimal + uniqueness solve) is
  // CPU-heavy and runs ~3–6s here, which overshoots vitest's 5s default once coverage
  // instrumentation slows it on shared CI runners. Matches the pattern in
  // difficulty-distribution.test.ts; not flakiness we can assert our way out of.
  it('never overshoots the target band and stays uniquely solvable', () => {
    for (const target of DIFFICULTIES) {
      for (let s = 0; s < 4; s++) {
        const g = generateForDifficulty(createPrng(deriveSeed('tectonic', target, 'overshoot', s)), target);
        expect(RANK[g.difficulty]).toBeLessThanOrEqual(RANK[target]);
        expect(g.difficulty).toBe(rate(g.instance));
        expect(solveComplete(g.instance, 2).count).toBe(1);
      }
    }
  }, 60000);

  it('reaches each target band within a seed batch', () => {
    for (const target of DIFFICULTIES) {
      let hit = false;
      for (let s = 0; s < 30 && !hit; s++) {
        if (generateForDifficulty(createPrng(deriveSeed('tectonic', target, 'reach', s)), target).difficulty === target) {
          hit = true;
        }
      }
      expect(hit, `target ${target} should be reachable`).toBe(true);
    }
  }, 60000);
});
