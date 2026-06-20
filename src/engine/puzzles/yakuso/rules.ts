import type { YakusoInstance, YakusoSolution } from './types';

/** Column sums of a flat `rows*cols` grid. */
export function columnSums(grid: number[], rows: number, cols: number): number[] {
  const out = new Array<number>(cols).fill(0);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out[c] += grid[r * cols + c];
  return out;
}

/** All size-`k` combinations of `arr` (k ≤ arr.length). */
export function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, acc: T[]): void => {
    if (acc.length === k) { out.push([...acc]); return; }
    for (let i = start; i <= arr.length - (k - acc.length); i++) {
      acc.push(arr[i]);
      pick(i + 1, acc);
      acc.pop();
    }
  };
  pick(0, []);
  return out;
}

/**
 * Whether `grid` (length rows*cols, each cell 0 or a digit) is a valid complete
 * YAKUSO solution for `inst`: every row owns one distinct digit `d` placed
 * exactly `d` times, the rows use a permutation of `1..rows`, and column sums
 * equal `totals`. Used by tests and as a final guard.
 */
export function isCompleteSolution(inst: YakusoInstance, grid: number[]): boolean {
  const { rows, cols, totals } = inst;
  if (grid.length !== rows * cols) return false;
  const usedDigits = new Set<number>();
  for (let r = 0; r < rows; r++) {
    let digit = 0;
    let count = 0;
    for (let c = 0; c < cols; c++) {
      const v = grid[r * cols + c];
      if (v === 0) continue;
      if (digit === 0) digit = v;
      else if (v !== digit) return false; // mixed digits in a row
      count++;
    }
    if (digit === 0) return false;            // empty row
    if (digit < 1 || digit > rows) return false;
    if (count !== digit) return false;         // digit d must appear d times
    if (usedDigits.has(digit)) return false;   // permutation
    usedDigits.add(digit);
  }
  const sums = columnSums(grid, rows, cols);
  // A hidden total (`null`) is unconstrained; the row rules already pin the grid there.
  return totals.every((t, c) => t === null || t === sums[c]);
}

export function serializeInstance(inst: YakusoInstance): string { return JSON.stringify(inst); }
export function deserializeInstance(s: string): YakusoInstance { return JSON.parse(s) as YakusoInstance; }
export function serializeSolution(sol: YakusoSolution): string { return sol.join(','); }
export function deserializeSolution(s: string): YakusoSolution { return s.split(',').map(Number); }
