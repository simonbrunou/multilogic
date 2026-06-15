import { describe, it, expect } from 'vitest';
import { generateForDifficulty, buildSquare } from '../../../../src/engine/puzzles/grecolatin/generator';
import { rate } from '../../../../src/engine/puzzles/grecolatin/rater';
import { validateGrid } from '../../../../src/engine/puzzles/grecolatin/rules';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import { DIFFICULTIES } from '../../../../src/engine/core/types';

describe('grecolatin generateForDifficulty (floored, honest rating)', () => {
  it('reported difficulty always equals the rater on the produced instance (honesty)', () => {
    for (const target of DIFFICULTIES) {
      const g = generateForDifficulty(createPrng(deriveSeed('grecolatin', target, 'honest', 0)), target);
      expect(g.difficulty).toBe(rate(g.instance));
    }
  });

  it('always returns a conflict-free partial Greco-Latin square', () => {
    for (const target of DIFFICULTIES) {
      const g = generateForDifficulty(createPrng(deriveSeed('grecolatin', target, 'valid', 0)), target);
      expect(validateGrid(g.instance.n, g.instance.givens).valid).toBe(true);
    }
  });

  it('easy, hard, and expert are reachable within the attempt budget (medium is the squeezed band at n=5)', () => {
    for (const target of ['easy', 'hard', 'expert'] as const) {
      let hit = false;
      for (let s = 0; s < 8 && !hit; s++) {
        if (generateForDifficulty(createPrng(deriveSeed('grecolatin', target, 'reach', s)), target).difficulty === target) hit = true;
      }
      expect(hit, `target ${target} reachable`).toBe(true);
    }
  });

  it('a medium request returns a valid puzzle in a near band (closest-fallback for the squeezed band)', () => {
    const g = generateForDifficulty(createPrng(deriveSeed('grecolatin', 'medium', 'near', 0)), 'medium');
    expect(['easy', 'medium', 'hard']).toContain(g.difficulty);
    expect(validateGrid(g.instance.n, g.instance.givens).valid).toBe(true);
  });

  it('buildSquare yields a complete valid Greco-Latin square', () => {
    expect(validateGrid(5, buildSquare(5, createPrng(42))!).complete).toBe(true);
    expect(validateGrid(5, buildSquare(5, createPrng(42))!).valid).toBe(true);
  });
});
