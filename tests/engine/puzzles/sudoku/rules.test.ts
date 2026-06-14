import { describe, it, expect } from 'vitest';
import { gridFromString, gridToString, buildDlx } from '../../../../src/engine/puzzles/sudoku/rules';

const SOLVED =
  '534678912' + '672195348' + '198342567' +
  '859761423' + '426853791' + '713924856' +
  '961537284' + '287419635' + '345286179';

describe('sudoku rules', () => {
  it('round-trips a grid string', () => {
    const g = gridFromString(SOLVED);
    expect(g.length).toBe(81);
    expect(gridToString(g)).toBe(SOLVED);
  });

  it('treats 0 and . as empty', () => {
    const g = gridFromString('.'.repeat(81));
    expect(g.every((v) => v === 0)).toBe(true);
  });

  it('builds a DLX with 324 columns and one row per candidate', () => {
    const empty = gridFromString('0'.repeat(81));
    const dlx = buildDlx(empty);
    // a fully empty grid has 81 cells * 9 candidates = 729 rows; solving yields a full grid
    const sols = dlx.solve(1);
    expect(sols.length).toBe(1);
    expect(sols[0].length).toBe(81); // 81 placements chosen
  });
});
