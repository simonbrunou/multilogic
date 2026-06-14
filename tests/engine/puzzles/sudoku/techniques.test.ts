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

  it('hiddenSingle finds the only spot for a digit in a unit', () => {
    const grid = new Array(81).fill(0);
    for (let c = 0; c < 8; c++) grid[1 + c] = c + 1;
    const cand = computeCandidates(grid);
    const step = hiddenSingle(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.placements).toContainEqual({ index: 0, digit: 9 });
  });
});
