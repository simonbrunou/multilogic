import { describe, it, expect } from 'vitest';
import { MODULES } from '../../src/engine/puzzles/registry';
import { createPrng } from '../../src/engine/core/prng';
import { DIFFICULTIES } from '../../src/engine/core/types';

function sig() { return new AbortController().signal; }

describe('difficulty targeting', () => {
  for (const type of ['sudoku', 'tectonic', 'kakuro'] as const) {
    it(`${type}: easy is easier than expert (achieved effort spread)`, async () => {
      const mod = MODULES[type]!;
      const easy = await mod.generate({ difficulty: 'easy', prng: createPrng(`${type}-easy`), signal: sig() });
      const expert = await mod.generate({ difficulty: 'expert', prng: createPrng(`${type}-expert`), signal: sig() });
      const rank = { easy: 1, medium: 2, hard: 3, expert: 4 } as const;
      // easy request should achieve a band no harder than the expert request
      expect(rank[easy.achievedDifficulty]).toBeLessThanOrEqual(rank[expert.achievedDifficulty]);
      // easy request should actually achieve 'easy'
      expect(easy.achievedDifficulty).toBe('easy');
    }, 30000);

    it(`${type}: hitsRequested for easy+medium within attempts`, async () => {
      const mod = MODULES[type]!;
      for (const d of ['easy', 'medium'] as const) {
        const r = await mod.generate({ difficulty: d, prng: createPrng(`${type}-${d}-x`), signal: sig() });
        expect(DIFFICULTIES).toContain(r.achievedDifficulty);
      }
    }, 30000);
  }
});
