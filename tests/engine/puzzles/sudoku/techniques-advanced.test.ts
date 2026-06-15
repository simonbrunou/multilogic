import { describe, it, expect } from 'vitest';
import { lockedCandidates, nakedPair, hiddenPair } from '../../../../src/engine/puzzles/sudoku/techniques';
import { computeCandidates } from '../../../../src/engine/puzzles/sudoku/candidates';

describe('advanced techniques', () => {
  it('lockedCandidates (pointing) eliminates a digit from a row outside the box', () => {
    const grid = new Array(81).fill(0);
    grid[9 + 3] = 4;  // row 1, col 3
    grid[18 + 4] = 4; // row 2, col 4
    const cand = computeCandidates(grid);
    const step = lockedCandidates(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.eliminations.every((e) => e.digit === 4)).toBe(true);
    expect(step!.eliminations.some((e) => e.index >= 3 && e.index <= 8)).toBe(true);
  });

  it('nakedPair eliminates the pair digits from the rest of a unit', () => {
    const grid = new Array(81).fill(0);
    for (let d = 3; d <= 9; d++) {
      grid[(d - 1) * 9 + 0] = d;
      grid[(d - 1) * 9 + 1] = d;
    }
    const cand = computeCandidates(grid);
    const step = nakedPair(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.eliminations.every((e) => e.digit === 1 || e.digit === 2)).toBe(true);
    expect(step!.eliminations.some((e) => e.index >= 2 && e.index <= 8)).toBe(true);
  });

  it('hiddenPair strips extra candidates from the two cells that alone hold a digit pair', () => {
    const grid = new Array(81).fill(0);
    // In row 0, force digits 3..9 to live outside cols 0 and 1 by placing them in
    // the peers of every other row-0 cell except cols 0,1... simplest: fill cols 2..8
    // of row 0 with 3,4,5,6,7,8,9 so only 1,2 remain available in row 0, and they can
    // only go in cols 0 and 1.
    const fills = [3, 4, 5, 6, 7, 8, 9];
    for (let k = 0; k < fills.length; k++) grid[2 + k] = fills[k]; // row 0, cols 2..8
    const cand = computeCandidates(grid);
    // cols 0 and 1 of row 0 currently both have {1,2}; inject a spurious extra candidate
    // to prove hiddenPair removes it: pretend col 0 also allows 5 (it cannot in a real
    // grid, but candidates are the test surface here).
    cand[0].add(5);
    const step = hiddenPair(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.eliminations).toContainEqual({ index: 0, digit: 5 });
    expect(step!.eliminations.every((e) => e.digit !== 1 && e.digit !== 2)).toBe(true);
  });
});
