import { describe, it, expect } from 'vitest';
import { makeCtx, isSolved, forcedCell, forcedDigit, comboElimination, runPossibleDigits, runForcedDigits } from '../../../../src/engine/puzzles/kakuro/techniques';
import { solveComplete } from '../../../../src/engine/puzzles/kakuro/solver';
import { generateForDifficulty } from '../../../../src/engine/puzzles/kakuro/generator';
import { rate } from '../../../../src/engine/puzzles/kakuro/rater';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import type { KakuroInstance } from '../../../../src/engine/puzzles/kakuro/types';

const forced: KakuroInstance = {
  width: 3, height: 2,
  black: [true, true, true, true, false, false],
  clues: [{}, { down: 1 }, { down: 2 }, { right: 3 }, null, null]
};

describe('kakuro combination engine', () => {
  it('runPossibleDigits: a 2-cell run summing to 3 allows only {1,2}', () => {
    const poss = runPossibleDigits({ cells: [4, 5], target: 3 }, [0, 0, 0, 0, 0, 0]);
    expect([...poss].sort()).toEqual([1, 2]);
  });

  it('runForcedDigits: a 2-cell run summing to 17 forces both {8,9}', () => {
    const f = runForcedDigits({ cells: [0, 1], target: 17 }, [0, 0]);
    expect([...f].sort()).toEqual([8, 9]);
  });

  it('runForcedDigits: a 2-cell run summing to 6 forces nothing ({1,5},{2,4})', () => {
    expect(runForcedDigits({ cells: [0, 1], target: 6 }, [0, 0]).size).toBe(0);
  });

  it('forcedCell solves the forced instance to completion', () => {
    const ctx = makeCtx(forced);
    let guard = 0;
    while (!isSolved(ctx) && forcedCell(ctx) && guard++ < 50) { /* drive */ }
    expect(isSolved(ctx)).toBe(true);
    expect(ctx.grid[4]).toBe(1);
    expect(ctx.grid[5]).toBe(2);
  });

  it('the technique ladder never contradicts the unique solution of generated puzzles', () => {
    for (let s = 0; s < 12; s++) {
      const g = generateForDifficulty(createPrng(deriveSeed('kakuro', 'easy', 'sound', s)), 'easy');
      const unique = solveComplete(g.instance, 2);
      expect(unique.count).toBe(1);
      const ctx = makeCtx(g.instance);
      let guard = 0;
      const apply = () => forcedCell(ctx) || forcedDigit(ctx) || comboElimination(ctx);
      while (!isSolved(ctx) && apply() && guard++ < 500) { /* solve */ }
      for (let i = 0; i < ctx.grid.length; i++) {
        if (!g.instance.black[i] && ctx.grid[i] !== 0) {
          expect(ctx.grid[i], `cell ${i} (seed ${s})`).toBe(unique.solution![i]);
        }
      }
    }
  });

  it('rate returns easy for the forced instance', () => {
    expect(rate(forced)).toBe('easy');
  });
});
