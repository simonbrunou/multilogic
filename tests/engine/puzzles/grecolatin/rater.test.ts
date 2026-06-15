import { describe, it, expect } from 'vitest';
import { rate, residualFreeRatio } from '../../../../src/engine/puzzles/grecolatin/rater';
import { buildSquare } from '../../../../src/engine/puzzles/grecolatin/generator';
import { createPrng } from '../../../../src/engine/core/prng';
import type { GrecoLatinInstance } from '../../../../src/engine/puzzles/grecolatin/types';

describe('grecolatin rater', () => {
  it('a fully-given square has residual ratio 0 and rates easy', () => {
    const sol = buildSquare(5, createPrng(1))!;
    const inst: GrecoLatinInstance = { n: 5, givens: sol };
    expect(residualFreeRatio(inst)).toBe(0);
    expect(rate(inst)).toBe('easy');
  });

  it('an all-empty square has residual ratio 1 and rates expert', () => {
    const inst: GrecoLatinInstance = { n: 5, givens: new Array(25).fill(0) };
    expect(residualFreeRatio(inst)).toBe(1);
    expect(rate(inst)).toBe('expert');
  });

  it('residualFreeRatio is in [0,1] and deterministic', () => {
    const sol = buildSquare(5, createPrng(7))!;
    const givens = sol.map((v, i) => (i % 2 === 0 ? v : 0));
    const inst: GrecoLatinInstance = { n: 5, givens };
    const r1 = residualFreeRatio(inst);
    expect(r1).toBeGreaterThanOrEqual(0);
    expect(r1).toBeLessThanOrEqual(1);
    expect(residualFreeRatio(inst)).toBe(r1);
  });

  it('rate returns a valid band', () => {
    const sol = buildSquare(5, createPrng(3))!;
    const givens = sol.map((v, i) => (i < 8 ? v : 0));
    expect(['easy', 'medium', 'hard', 'expert']).toContain(rate({ n: 5, givens }));
  });
});
