import { describe, it, expect } from 'vitest';
import { rate } from '../../../../src/engine/puzzles/yakuso/rater';
import { generateForDifficulty } from '../../../../src/engine/puzzles/yakuso/generator';
import { createPrng } from '../../../../src/engine/core/prng';

const RANK = { easy: 1, medium: 2, hard: 3, expert: 4 } as const;

describe('yakuso rater', () => {
  it('a fully-seeded instance rates easy (effort 0)', () => {
    const g = generateForDifficulty(createPrng('rate-easy'), 'easy');
    const full = { ...g.instance, clues: [...g.solution] };
    expect(rate(full)).toBe('easy');
  });

  // 20 full generations including expert (with a hidden total the search is larger);
  // the generous timeout absorbs the occasional pathological seed.
  it('generated instances never rate harder than requested (difficulty is bounded)', () => {
    for (const d of ['easy', 'medium', 'hard', 'expert'] as const) {
      for (let n = 0; n < 5; n++) {
        const g = generateForDifficulty(createPrng(`rate-${d}-${n}`), d);
        expect(RANK[rate(g.instance)]).toBeLessThanOrEqual(RANK[d]);
      }
    }
  }, 30000);
});
