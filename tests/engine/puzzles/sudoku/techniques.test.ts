import { describe, it, expect } from 'vitest';
import { nakedSingle, hiddenSingle } from '../../../../src/engine/puzzles/sudoku/techniques';
import { computeCandidates } from '../../../../src/engine/puzzles/sudoku/candidates';

describe('singles techniques', () => {
  it('nakedSingle finds a cell with one candidate', () => {
    const grid = new Array(81).fill(0);
    [1, 2, 3, 4, 5, 6, 7, 8].forEach((d, k) => { grid[1 + k] = d; });
    const cand = computeCandidates(grid);
    const step = nakedSingle(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.placements).toEqual([{ index: 0, digit: 9 }]);
  });

  it('nakedSingle returns null when no singleton empty cell exists', () => {
    const grid = new Array(81).fill(0);
    const cand = computeCandidates(grid);
    expect(nakedSingle(grid, cand)).toBeNull();
  });

  it('hiddenSingle finds the only spot for a digit in a unit (cell keeps other candidates)', () => {
    const grid = new Array(81).fill(0);
    // Block digit 7 from row-0 cells 1..8 via their COLUMNS (place 7 in row 8, cols 1..8),
    // without touching box 0 / column 0 / row 0 — so cell 0 keeps all 9 candidates,
    // yet 7 can only go in cell 0 within row 0 → a genuine hidden single.
    for (let c = 1; c <= 8; c++) grid[72 + c] = 7;
    const cand = computeCandidates(grid);
    expect(cand[0].size).toBeGreaterThan(1); // NOT a naked single
    const step = hiddenSingle(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.technique).toBe('hiddenSingle');
    expect(step!.placements).toEqual([{ index: 0, digit: 7 }]);
  });

  it('hiddenSingle returns null on an empty grid', () => {
    const grid = new Array(81).fill(0);
    expect(hiddenSingle(grid, computeCandidates(grid))).toBeNull();
  });
});
