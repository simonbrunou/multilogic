import { describe, it, expect } from 'vitest';
import { generateForDifficulty } from '../../../../src/engine/puzzles/grecolatin/generator';
import { rate } from '../../../../src/engine/puzzles/grecolatin/rater';
import { validateGrid } from '../../../../src/engine/puzzles/grecolatin/rules';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import { DIFFICULTIES } from '../../../../src/engine/core/types';

describe('grecolatin generateForDifficulty (partial clues, floored)', () => {
  it('reported difficulty equals the rater on the produced instance (honesty)', () => {
    for (const target of DIFFICULTIES) {
      const g = generateForDifficulty(createPrng(deriveSeed('grecolatin', target, 'honest', 0)), target);
      expect(g.difficulty).toBe(rate(g.instance));
    }
  });

  it('clues are a valid partial revelation of a real square (no conflicts)', () => {
    const g = generateForDifficulty(createPrng(deriveSeed('grecolatin', 'hard', 'valid', 0)), 'hard');
    const n = g.instance.n;
    // Build a full grid from clues where both dims are known; validate that sub-grid has no conflicts.
    const cells = g.instance.digitClues.map((a, i) =>
      a !== null && g.instance.letterClues[i] !== null ? a * n + (g.instance.letterClues[i] as number) + 1 : 0
    );
    expect(validateGrid(n, cells).valid).toBe(true);
  });

  it('partial clues actually appear at higher difficulties', () => {
    const g = generateForDifficulty(createPrng(deriveSeed('grecolatin', 'hard', 'partial', 0)), 'hard');
    const partial = g.instance.digitClues.some((a, i) => (a === null) !== (g.instance.letterClues[i] === null));
    expect(partial).toBe(true); // at least one cell has exactly one dimension clued
  });

  it('easy and hard are reachable within the attempt budget', () => {
    for (const target of ['easy', 'hard'] as const) {
      let hit = false;
      for (let s = 0; s < 20 && !hit; s++) {
        if (generateForDifficulty(createPrng(deriveSeed('grecolatin', target, 'reach', s)), target).difficulty === target) hit = true;
      }
      expect(hit, `target ${target} reachable`).toBe(true);
    }
  });
});
