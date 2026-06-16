import { describe, it, expect } from 'vitest';
import { rate, residualFreeRatio } from '../../../../src/engine/puzzles/grecolatin/rater';
import { buildSquare } from '../../../../src/engine/puzzles/grecolatin/generator';
import { decodePair } from '../../../../src/engine/puzzles/grecolatin/rules';
import { analyze, candidatesAt } from '../../../../src/engine/puzzles/grecolatin/candidates';
import { createPrng } from '../../../../src/engine/core/prng';
import type { GrecoLatinInstance } from '../../../../src/engine/puzzles/grecolatin/types';

function fullClues(n: number, sol: number[]): GrecoLatinInstance {
  const digitClues = sol.map((v) => decodePair(v, n)!.a);
  const letterClues = sol.map((v) => decodePair(v, n)!.b);
  return { n, digitClues, letterClues };
}

describe('grecolatin rater (partial-aware)', () => {
  it('a fully-given square has residual ratio 0 and rates easy', () => {
    const sol = buildSquare(5, createPrng(1))!;
    expect(residualFreeRatio(fullClues(5, sol))).toBe(0);
    expect(rate(fullClues(5, sol))).toBe('easy');
  });

  it('an all-open grid has residual ratio 1 and rates expert', () => {
    const inst: GrecoLatinInstance = { n: 5, digitClues: new Array(25).fill(null), letterClues: new Array(25).fill(null) };
    expect(residualFreeRatio(inst)).toBe(1);
    expect(rate(inst)).toBe('expert');
  });

  it('residualFreeRatio is in [0,1] and deterministic for a partial-clue instance', () => {
    const sol = buildSquare(5, createPrng(7))!;
    const full = fullClues(5, sol);
    // keep a partial mix: even cells digit-only, odd cells letter-only, first 10 cells dropped
    const digitClues = full.digitClues.map((a, i) => (i < 10 ? null : i % 2 === 0 ? a : null));
    const letterClues = full.letterClues.map((b, i) => (i < 10 ? null : i % 2 === 1 ? b : null));
    const inst: GrecoLatinInstance = { n: 5, digitClues, letterClues };
    const r = residualFreeRatio(inst);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(residualFreeRatio(inst)).toBe(r);
  });

  it('SOUNDNESS: propagation never fixes a dimension to a value inconsistent with the generating square', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const prng = createPrng(seed * 7);
      const sol = buildSquare(5, prng)!;
      const n = 5;
      const solA = sol.map((v) => Math.floor((v - 1) / n));
      const solB = sol.map((v) => (v - 1) % n);
      // Reveal partial: odd cells digit-only, even cells letter-only, first 5 dropped
      const kA: (number | null)[] = sol.map((v, i) => i < 5 ? null : i % 2 === 1 ? solA[i] : null);
      const kB: (number | null)[] = sol.map((v, i) => i < 5 ? null : i % 2 === 0 ? solB[i] : null);
      let changed = true;
      while (changed) {
        changed = false;
        const an = analyze(n, kA, kB);
        for (let i = 0; i < n * n; i++) {
          if (kA[i] !== null && kB[i] !== null) continue;
          const cands = candidatesAt(n, an, kA, kB, i);
          if (cands.length === 0) continue;
          if (kA[i] === null && cands.every((c) => c.a === cands[0].a)) {
            expect(cands[0].a).toBe(solA[i]);
            kA[i] = cands[0].a; changed = true; break;
          }
          if (kB[i] === null && cands.every((c) => c.b === cands[0].b)) {
            expect(cands[0].b).toBe(solB[i]);
            kB[i] = cands[0].b; changed = true; break;
          }
        }
      }
    }
  });
});
