import { describe, it, expect } from 'vitest';
import { analyze, candidatesAt } from '../../../../src/engine/puzzles/grecolatin/candidates';

// Helpers: build knownA/knownB arrays for n=3.
const N = 3;
const open = () => ({ knownA: new Array<number | null>(9).fill(null), knownB: new Array<number | null>(9).fill(null) });

describe('grecolatin candidates (per-dimension)', () => {
  it('a fully-open cell on an empty grid has all n*n pairs', () => {
    const { knownA, knownB } = open();
    const an = analyze(N, knownA, knownB);
    expect(candidatesAt(N, an, knownA, knownB, 0).length).toBe(N * N);
  });

  it('a digit-only clue restricts that cell to its a, and excludes that a from row/col peers', () => {
    const { knownA, knownB } = open();
    knownA[0] = 1; // cell 0 (row0,col0) digit = 1
    const an = analyze(N, knownA, knownB);
    // cell 0: a fixed to 1 → all candidates have a===1
    expect(candidatesAt(N, an, knownA, knownB, 0).every((c) => c.a === 1)).toBe(true);
    // cell 1 (row0,col1): a=1 excluded (same row)
    expect(candidatesAt(N, an, knownA, knownB, 1).some((c) => c.a === 1)).toBe(false);
  });

  it('a letter-only clue is transparent to the a-projection (digit candidates unaffected for peers)', () => {
    const { knownA, knownB } = open();
    knownB[0] = 2; // cell 0 letter = 2, digit unknown
    const an = analyze(N, knownA, knownB);
    // cell 1's a-candidates are NOT restricted by cell 0 (whose a is unknown)
    const aVals = new Set(candidatesAt(N, an, knownA, knownB, 1).map((c) => c.a));
    expect(aVals.size).toBe(N); // all digits still possible for cell 1's a
    // but cell 1's b excludes 2 (same row, letter known)
    expect(candidatesAt(N, an, knownA, knownB, 1).some((c) => c.b === 2)).toBe(false);
  });

  it('a fully-known cell contributes a used pair that other cells exclude', () => {
    const { knownA, knownB } = open();
    knownA[0] = 1; knownB[0] = 2; // cell 0 = pair (1,2)
    const an = analyze(N, knownA, knownB);
    // cell 8 (row2,col2): pair (1,2) excluded globally
    expect(candidatesAt(N, an, knownA, knownB, 8).some((c) => c.a === 1 && c.b === 2)).toBe(false);
  });
});
