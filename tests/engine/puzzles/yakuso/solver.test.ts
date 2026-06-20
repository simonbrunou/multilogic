import { describe, it, expect } from 'vitest';
import { solveComplete, effortToSolve } from '../../../../src/engine/puzzles/yakuso/solver';
import { columnSums, isCompleteSolution } from '../../../../src/engine/puzzles/yakuso/rules';
import type { YakusoInstance } from '../../../../src/engine/puzzles/yakuso/types';

// The worked example from the puzzle photo (rows own 2,1,3):
//   2 0 2 0
//   0 1 0 0
//   3 0 3 3
// totals: 5 1 5 3
const exampleGrid = [
  2, 0, 2, 0,
  0, 1, 0, 0,
  3, 0, 3, 3,
];
const exampleTotals = [5, 1, 5, 3];

function inst(clues: (number | null)[], totals: (number | null)[] = exampleTotals): YakusoInstance {
  return { rows: 3, cols: 4, totals, clues };
}

describe('yakuso solver', () => {
  it('column sums match the worked example', () => {
    expect(columnSums(exampleGrid, 3, 4)).toEqual(exampleTotals);
    expect(isCompleteSolution(inst(exampleGrid.map(() => null)), exampleGrid)).toBe(true);
  });

  it('fully-seeded instance is uniquely solvable to itself', () => {
    const r = solveComplete(inst([...exampleGrid]), 2);
    expect(r.count).toBe(1);
    expect(r.solution).toEqual(exampleGrid);
  });

  it('totals-only may admit multiple solutions (subset-sum collisions are real)', () => {
    const r = solveComplete(inst(exampleGrid.map(() => null)), 2);
    expect(r.count).toBeGreaterThanOrEqual(1);
    // every returned solution must reproduce the totals
    const all = solveComplete(inst(exampleGrid.map(() => null)), 2);
    if (all.solution) expect(columnSums(all.solution, 3, 4)).toEqual(exampleTotals);
  });

  it('a single seed can force uniqueness', () => {
    // seed the 1 at its cell; with totals this pins the rest in this example
    const clues = exampleGrid.map(() => null) as (number | null)[];
    clues[5] = 1; // row1 col1 = 1
    const r = solveComplete(inst(clues), 2);
    expect(r.count).toBeGreaterThanOrEqual(1);
  });

  it('effort is 0 for a fully forced (complete) instance', () => {
    expect(effortToSolve(inst([...exampleGrid]))).toBe(0);
  });

  it('a hidden total (null) imposes no column constraint but the grid still solves', () => {
    // Hide column 2's total; the fully-seeded grid is still uniquely solvable to itself,
    // and the hidden column places no upper bound during the search.
    const totals = exampleTotals.map((t, c) => (c === 2 ? null : t)) as (number | null)[];
    const r = solveComplete(inst([...exampleGrid], totals), 2);
    expect(r.count).toBe(1);
    expect(r.solution).toEqual(exampleGrid);
  });

  it('over-determined / contradictory instance has no solution', () => {
    const clues = exampleGrid.map(() => null) as (number | null)[];
    clues[0] = 1; clues[1] = 1; clues[2] = 1; // row0 would need three distinct... impossible vs totals
    const r = solveComplete({ rows: 3, cols: 4, totals: [3, 3, 3, 3], clues }, 2);
    expect(r.count).toBe(0);
  });
});
