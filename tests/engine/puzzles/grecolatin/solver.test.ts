import { describe, it, expect } from 'vitest';
import { solveComplete } from '../../../../src/engine/puzzles/grecolatin/solver';
import { buildSquare } from '../../../../src/engine/puzzles/grecolatin/generator';
import { decodePair } from '../../../../src/engine/puzzles/grecolatin/rules';
import { createPrng } from '../../../../src/engine/core/prng';
import type { GrecoLatinInstance } from '../../../../src/engine/puzzles/grecolatin/types';

function fullClues(n: number, sol: number[]): GrecoLatinInstance {
  return {
    n,
    digitClues: sol.map((v) => decodePair(v, n)!.a),
    letterClues: sol.map((v) => decodePair(v, n)!.b)
  };
}

describe('grecolatin solver (uniqueness oracle)', () => {
  it('a fully-given square has exactly one completion', () => {
    const sol = buildSquare(5, createPrng(1))!;
    expect(solveComplete(fullClues(5, sol), 2).count).toBe(1);
  });

  it('an all-open grid is under-constrained (count capped at the limit)', () => {
    const inst: GrecoLatinInstance = {
      n: 5,
      digitClues: new Array(25).fill(null),
      letterClues: new Array(25).fill(null)
    };
    expect(solveComplete(inst, 2).count).toBe(2);
  });

  it('reports zero completions for a contradictory clue set', () => {
    // Two cells in the same row forced to the same digit → no valid Latin completion.
    const digitClues = new Array<number | null>(25).fill(null);
    const letterClues = new Array<number | null>(25).fill(null);
    digitClues[0] = 0;
    digitClues[1] = 0; // same row, duplicate digit
    expect(solveComplete({ n: 5, digitClues, letterClues }, 2).count).toBe(0);
  });

  it('count is deterministic for a given instance', () => {
    const sol = buildSquare(5, createPrng(3))!;
    const inst = fullClues(5, sol);
    expect(solveComplete(inst, 5).count).toBe(solveComplete(inst, 5).count);
  });
});
