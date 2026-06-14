import { describe, it, expect } from 'vitest';
import { buildSquare, generateForDifficulty } from '../../../../src/engine/puzzles/grecolatin/generator';
import { validateGrid } from '../../../../src/engine/puzzles/grecolatin/rules';
import { createPrng } from '../../../../src/engine/core/prng';

describe('grecolatin generator', () => {
  it('buildSquare yields a valid complete Greco-Latin square for each valid order', () => {
    for (const n of [3, 4, 5, 7, 8, 9]) {
      const sq = buildSquare(n, createPrng('s' + n));
      expect(sq).not.toBeNull();
      const r = validateGrid(n, sq!);
      expect(r.complete).toBe(true);
      expect(r.valid).toBe(true);
    }
  });
  it('buildSquare is deterministic for a seed', () => {
    expect(buildSquare(5, createPrng('z'))).toEqual(buildSquare(5, createPrng('z')));
  });
  it('generateForDifficulty produces givens that are a subset of a valid square', () => {
    const g = generateForDifficulty(createPrng('g1'), 'easy', 5);
    expect(g.instance.n).toBe(5);
    // the givens alone must be conflict-free (they come from a valid square)
    expect(validateGrid(5, g.instance.givens).valid).toBe(true);
    const filled = g.instance.givens.filter((v) => v !== 0).length;
    expect(filled).toBeGreaterThan(0);
    expect(filled).toBeLessThan(25);
  });
  it('easy reveals more givens than hard', () => {
    const easy = generateForDifficulty(createPrng('a'), 'easy', 5).instance.givens.filter((v) => v !== 0).length;
    const hard = generateForDifficulty(createPrng('a'), 'hard', 5).instance.givens.filter((v) => v !== 0).length;
    expect(easy).toBeGreaterThan(hard);
  });
});
