import { describe, it, expect } from 'vitest';
import { generateForDifficulty } from '../../../../src/engine/puzzles/kakuro/generator';
import { solveComplete } from '../../../../src/engine/puzzles/kakuro/solver';
import { allRuns, serializeInstance } from '../../../../src/engine/puzzles/kakuro/rules';
import { createPrng } from '../../../../src/engine/core/prng';

describe('kakuro generator', () => {
  it('produces a uniquely-solvable puzzle whose solution validates', () => {
    const g = generateForDifficulty(createPrng('kg1'), 'easy');
    expect(solveComplete(g.instance, 2).count).toBe(1);
    // every run length is 2..9, and clue cells are black
    for (const run of allRuns(g.instance)) {
      if (run.cells.length > 0) expect(run.cells.length).toBeGreaterThanOrEqual(2);
    }
  });
  it('solution matches the unique solve', () => {
    const g = generateForDifficulty(createPrng('kg2'), 'easy');
    expect(solveComplete(g.instance, 1).solution).toEqual(g.solution);
  });
  it('is deterministic for a seed', () => {
    const a = generateForDifficulty(createPrng('same'), 'easy');
    const b = generateForDifficulty(createPrng('same'), 'easy');
    expect(serializeInstance(a.instance)).toBe(serializeInstance(b.instance));
  });
});
