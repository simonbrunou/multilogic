import { describe, it, expect } from 'vitest';
import { generateForDifficulty } from '../../../../src/engine/puzzles/yakuso/generator';
import { solveComplete } from '../../../../src/engine/puzzles/yakuso/solver';
import { isCompleteSolution, columnSums } from '../../../../src/engine/puzzles/yakuso/rules';
import { createPrng } from '../../../../src/engine/core/prng';
import { DIFFICULTIES } from '../../../../src/engine/core/types';

// Column totals hidden from the player per difficulty (mirrors the generator's HIDDEN map).
const HIDDEN: Record<(typeof DIFFICULTIES)[number], number> = { easy: 1, medium: 1, hard: 1, expert: 2 };

describe('yakuso generator', () => {
  for (const d of DIFFICULTIES) {
    it(`${d}: produces a unique instance whose stored solution is valid and reproduces totals`, () => {
      const g = generateForDifficulty(createPrng(`yakuso-${d}-gen`), d);
      // solution is a valid complete YAKUSO grid
      expect(isCompleteSolution(g.instance, g.solution)).toBe(true);
      // the difficulty's quota of totals is hidden (null); the rest come from the solution
      const sums = columnSums(g.solution, g.instance.rows, g.instance.cols);
      expect(g.instance.totals.filter((t) => t === null)).toHaveLength(HIDDEN[d]);
      g.instance.totals.forEach((t, c) => { if (t !== null) expect(t).toBe(sums[c]); });
      // uniquely solvable
      const r = solveComplete(g.instance, 2);
      expect(r.count).toBe(1);
      expect(r.solution).toEqual(g.solution);
      // every clue is consistent with the solution
      g.instance.clues.forEach((c, i) => { if (c !== null) expect(c).toBe(g.solution[i]); });
      // sizing: cols = rows + 1
      expect(g.instance.cols).toBe(g.instance.rows + 1);
    });
  }

  it('is deterministic per seed', () => {
    const a = generateForDifficulty(createPrng('yakuso-det'), 'medium');
    const b = generateForDifficulty(createPrng('yakuso-det'), 'medium');
    expect(a.instance).toEqual(b.instance);
    expect(a.solution).toEqual(b.solution);
  });

  it('grid size grows with difficulty', () => {
    const rowsOf = (d: Parameters<typeof generateForDifficulty>[1]) =>
      generateForDifficulty(createPrng(`yakuso-size-${d}`), d).instance.rows;
    expect(rowsOf('easy')).toBe(3);
    expect(rowsOf('medium')).toBe(4);
    expect(rowsOf('hard')).toBe(5);
    expect(rowsOf('expert')).toBe(6);
  });
});
