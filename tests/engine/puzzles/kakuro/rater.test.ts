import { describe, it, expect } from 'vitest';
import { rate } from '../../../../src/engine/puzzles/kakuro/rater';
import type { KakuroInstance } from '../../../../src/engine/puzzles/kakuro/types';

// 3x2 grid: row0 all black, row1 = [black, white, white] (cells 4,5).
// h-run [4,5] sum 3 ({1,2}); single-cell v-runs force cell4=1 (down 1), cell5=2 (down 2).
// → uniquely solvable by propagation → 'easy'.
const forced: KakuroInstance = {
  width: 3, height: 2,
  black: [true, true, true, true, false, false],
  clues: [{}, { down: 1 }, { down: 2 }, { right: 3 }, null, null]
};

describe('kakuro rater', () => {
  it('rates a propagation-solvable forced instance as easy', () => {
    expect(rate(forced)).toBe('easy');
  });
  it('returns a valid difficulty band', () => {
    expect(['easy', 'medium', 'hard', 'expert']).toContain(rate(forced));
  });
});
