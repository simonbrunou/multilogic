import { Dlx } from '../../core/dlx';
import { candidateColumns, rowIdFor, gridFromSolution } from './rules';
import type { SudokuGrid } from './types';
import type { PRNG } from '../../core/prng';

/**
 * Generate a complete, valid Sudoku solution deterministically from a PRNG.
 * Strategy: build the full 729-candidate DLX but add each cell's 9 candidates in a
 * PRNG-shuffled digit order. DLX picks the first viable branch, so shuffling the
 * insertion order yields a random — yet seed-reproducible — solution.
 */
export function generateFullGrid(prng: PRNG): SudokuGrid {
  const dlx = new Dlx(324);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const digits = prng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const d of digits) {
        dlx.addRow(rowIdFor(r, c, d), candidateColumns(r, c, d));
      }
    }
  }
  const sols = dlx.solve(1);
  if (sols.length === 0) throw new Error('failed to generate a full grid');
  return gridFromSolution(sols[0]);
}
