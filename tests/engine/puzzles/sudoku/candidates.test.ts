import { describe, it, expect } from 'vitest';
import { UNITS, ROWS, COLS, BOXES, PEERS, computeCandidates } from '../../../../src/engine/puzzles/sudoku/candidates';
import { gridFromString } from '../../../../src/engine/puzzles/sudoku/rules';

describe('candidates model', () => {
  it('has 27 units of 9 cells each', () => {
    expect(UNITS.length).toBe(27);
    expect(UNITS.every((u) => u.length === 9)).toBe(true);
    expect(ROWS.length).toBe(9);
    expect(COLS.length).toBe(9);
    expect(BOXES.length).toBe(9);
  });

  it('row/col/box membership is correct', () => {
    expect(ROWS[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(COLS[0]).toEqual([0, 9, 18, 27, 36, 45, 54, 63, 72]);
    expect(BOXES[0]).toEqual([0, 1, 2, 9, 10, 11, 18, 19, 20]);
  });

  it('each cell has 20 distinct peers, excluding itself', () => {
    expect(PEERS.length).toBe(81);
    expect(PEERS.every((p) => p.length === 20)).toBe(true);
    expect(PEERS[0]).not.toContain(0);
    expect(PEERS[0]).toEqual(expect.arrayContaining([1, 9, 10, 8, 72]));
  });

  it('computeCandidates: filled cell yields a singleton set', () => {
    const grid = gridFromString('5' + '0'.repeat(80));
    expect([...computeCandidates(grid)[0]]).toEqual([5]);
  });

  it('computeCandidates: empty cell excludes peer digits', () => {
    const g = new Array(81).fill(0);
    g[1] = 1; g[9] = 2;
    const c0 = computeCandidates(g)[0];
    expect(c0.has(1)).toBe(false);
    expect(c0.has(2)).toBe(false);
    expect(c0.has(3)).toBe(true);
  });
});
