import { describe, it, expect } from 'vitest';
import { lockedCandidates, nakedPair, hiddenPair, nakedTriple, hiddenTriple } from '../../../../src/engine/puzzles/sudoku/techniques';
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

  it('nakedTriple eliminates the trio digits from the rest of the unit', () => {
    const fills = [4, 5, 6, 7, 8, 9];
    // trio in column 0, rows 0,1,2 = {1,2}/{2,3}/{1,3}; fill rows 3..8 col 0 with 4..9.
    const g2 = new Array(81).fill(0);
    for (let k = 0; k < fills.length; k++) g2[(3 + k) * 9] = fills[k]; // col 0, rows 3..8
    const c2 = computeCandidates(g2);
    c2[0] = new Set([1, 2]);
    c2[9] = new Set([2, 3]);
    c2[18] = new Set([1, 3]);
    const step = nakedTriple(g2, c2);
    expect(step).not.toBeNull();
    expect(step!.eliminations.every((e) => [1, 2, 3].includes(e.digit))).toBe(true);
  });

  it('hiddenTriple strips extra candidates from the three cells that alone hold a digit trio', () => {
    const grid = new Array(81).fill(0);
    // Column 0: confine digits 1,2,3 to rows 0,1,2 by filling rows 3..8 of col 0 with 4..9.
    const fills = [4, 5, 6, 7, 8, 9];
    for (let k = 0; k < fills.length; k++) grid[(3 + k) * 9] = fills[k];
    const cand = computeCandidates(grid);
    // rows 0,1,2 of col 0 each allow {1,2,3}; inject a spurious extra to see it removed.
    cand[0].add(8);
    const step = hiddenTriple(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.eliminations).toContainEqual({ index: 0, digit: 8 });
    expect(step!.eliminations.every((e) => ![1, 2, 3].includes(e.digit))).toBe(true);
  });
});
