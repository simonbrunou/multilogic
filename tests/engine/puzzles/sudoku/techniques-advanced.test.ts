import { describe, it, expect } from 'vitest';
import { lockedCandidates, nakedPair } from '../../../../src/engine/puzzles/sudoku/techniques';
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
});
