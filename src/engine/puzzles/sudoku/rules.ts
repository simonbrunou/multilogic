import { Dlx } from '../../core/dlx';
import type { SudokuGrid } from './types';

export const N = 9;
export const CELLS = 81;

export function gridFromString(s: string): SudokuGrid {
  const clean = s.trim();
  if (clean.length !== CELLS) throw new Error(`grid must be ${CELLS} chars, got ${clean.length}`);
  if (!/^[0-9.]+$/.test(clean)) throw new Error('grid must contain only 0-9 or . characters');
  return [...clean].map((ch) => (ch === '.' || ch === '0' ? 0 : Number(ch)));
}

export function gridToString(g: SudokuGrid): string {
  return g.map((v) => (v === 0 ? '0' : String(v))).join('');
}

/**
 * Exact-cover column layout (324 columns):
 *   0..80    cell (r,c) is filled                     : index r*9+c
 *   81..161  row r contains digit d                   : 81 + r*9 + (d-1)
 *   162..242 col c contains digit d                   : 162 + c*9 + (d-1)
 *   243..323 box b contains digit d                   : 243 + b*9 + (d-1)
 * A candidate "place digit d at (r,c)" covers exactly those 4 columns.
 * rowId encodes the placement as (r*9+c)*9 + (d-1) so a solution maps back to a grid.
 */
export function candidateColumns(r: number, c: number, d: number): number[] {
  const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
  return [
    r * 9 + c,
    81 + r * 9 + (d - 1),
    162 + c * 9 + (d - 1),
    243 + box * 9 + (d - 1)
  ];
}

export function rowIdFor(r: number, c: number, d: number): number {
  return (r * 9 + c) * 9 + (d - 1);
}

export function decodeRowId(rowId: number): { r: number; c: number; d: number } {
  const d = (rowId % 9) + 1;
  const cell = Math.floor(rowId / 9);
  return { r: Math.floor(cell / 9), c: cell % 9, d };
}

/** Build a DLX for the given grid, restricting candidates to the givens where present. */
export function buildDlx(grid: SudokuGrid): Dlx {
  if (grid.length !== CELLS) {
    throw new Error(`buildDlx: grid must have ${CELLS} cells, got ${grid.length}`);
  }
  for (const v of grid) {
    if (!Number.isInteger(v) || v < 0 || v > 9) {
      throw new Error(`buildDlx: cell values must be integers 0-9, got ${v}`);
    }
  }
  const dlx = new Dlx(324);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const given = grid[r * 9 + c];
      const digits = given === 0 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [given];
      for (const d of digits) {
        dlx.addRow(rowIdFor(r, c, d), candidateColumns(r, c, d));
      }
    }
  }
  return dlx;
}

/** Convert a DLX solution (list of rowIds) back into a solved grid. */
export function gridFromSolution(rowIds: number[]): SudokuGrid {
  const g = new Array(CELLS).fill(0);
  for (const id of rowIds) {
    const { r, c, d } = decodeRowId(id);
    g[r * 9 + c] = d;
  }
  return g;
}
