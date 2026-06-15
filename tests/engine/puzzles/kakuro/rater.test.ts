import { describe, it, expect } from 'vitest';
import { rate, solveWithTechniques } from '../../../../src/engine/puzzles/kakuro/rater';
import type { KakuroInstance } from '../../../../src/engine/puzzles/kakuro/types';

const forced: KakuroInstance = {
  width: 3, height: 2,
  black: [true, true, true, true, false, false],
  clues: [{}, { down: 1 }, { down: 2 }, { right: 3 }, null, null]
};

describe('kakuro rater', () => {
  it('rates a forced-cell-solvable instance as easy', () => {
    expect(rate(forced)).toBe('easy');
  });

  it('solveWithTechniques solves the forced instance', () => {
    expect(solveWithTechniques(forced).solved).toBe(true);
  });

  it('returns a valid difficulty band', () => {
    expect(['easy', 'medium', 'hard', 'expert']).toContain(rate(forced));
  });
});
