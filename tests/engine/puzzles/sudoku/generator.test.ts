import { describe, it, expect } from 'vitest';
import { generateForDifficulty } from '../../../../src/engine/puzzles/sudoku/generator';
import { solveComplete } from '../../../../src/engine/puzzles/sudoku/solver';
import { gridToString } from '../../../../src/engine/puzzles/sudoku/rules';
import { rate } from '../../../../src/engine/puzzles/sudoku/rater';
import { createPrng } from '../../../../src/engine/core/prng';

describe('generateForDifficulty', () => {
  it('produces a puzzle whose givens are a subset of the solution', () => {
    const g = generateForDifficulty(createPrng('gen-1'), 'easy');
    expect(g.solution.length).toBe(81);
    for (let i = 0; i < 81; i++) {
      if (g.givens[i] !== 0) expect(g.givens[i]).toBe(g.solution[i]);
    }
  });

  it('produces a uniquely-solvable puzzle', () => {
    const g = generateForDifficulty(createPrng('gen-2'), 'medium');
    expect(solveComplete({ givens: g.givens }, 2).count).toBe(1);
  });

  it('the reported difficulty matches rate() of the givens', () => {
    const g = generateForDifficulty(createPrng('gen-3'), 'easy');
    expect(g.difficulty).toBe(rate({ givens: g.givens }));
  });

  it('an easy target does not exceed easy difficulty', () => {
    const g = generateForDifficulty(createPrng('gen-4'), 'easy');
    expect(g.difficulty).toBe('easy');
  });

  it('is deterministic for a seed', () => {
    const a = generateForDifficulty(createPrng('same-seed'), 'medium');
    const b = generateForDifficulty(createPrng('same-seed'), 'medium');
    expect(gridToString(a.givens)).toBe(gridToString(b.givens));
  });

  it('digs out a meaningful number of cells (puzzle is not nearly full)', () => {
    const g = generateForDifficulty(createPrng('gen-5'), 'hard');
    const givenCount = g.givens.filter((v) => v !== 0).length;
    expect(givenCount).toBeLessThan(60);
  });
});
