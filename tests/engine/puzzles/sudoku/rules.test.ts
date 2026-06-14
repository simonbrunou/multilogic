import { describe, it, expect } from 'vitest';
import { gridFromString, gridToString, buildDlx, candidateColumns, rowIdFor, decodeRowId, gridFromSolution } from '../../../../src/engine/puzzles/sudoku/rules';

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

  it('throws on wrong length', () => {
    expect(() => gridFromString('123')).toThrow();
  });

  it('throws on invalid characters', () => {
    expect(() => gridFromString('a'.repeat(81))).toThrow();
  });

  it('rowIdFor and decodeRowId are inverses', () => {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        for (let d = 1; d <= 9; d++)
          expect(decodeRowId(rowIdFor(r, c, d))).toEqual({ r, c, d });
  });

  it('candidateColumns returns the 4 constraint columns for a placement', () => {
    // r=0,c=0,d=1 → cell 0, row-band 81, col-band 162, box-band 243
    expect(candidateColumns(0, 0, 1)).toEqual([0, 81, 162, 243]);
    // r=4,c=4,d=5 → cell 40, 81+36+4=121, 162+36+4=202, box=4 → 243+36+4=283
    expect(candidateColumns(4, 4, 5)).toEqual([40, 121, 202, 283]);
  });

  it('buildDlx + gridFromSolution decode a solved grid with digits 1-9', () => {
    const empty = gridFromString('0'.repeat(81));
    const sols = buildDlx(empty).solve(1);
    const grid = gridFromSolution(sols[0]);
    expect(grid.length).toBe(81);
    expect(grid.every((v) => v >= 1 && v <= 9)).toBe(true);
  });
});
