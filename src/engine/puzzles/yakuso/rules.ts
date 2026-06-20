import type { YakusoInstance, YakusoSolution } from './types';

/** Column sums of a flat `rows*cols` grid. */
export function columnSums(grid: number[], rows: number, cols: number): number[] {
  const out = new Array<number>(cols).fill(0);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out[c] += grid[r * cols + c];
  return out;
}

/**
 * The full column totals, with the single hidden total (`null`) reconstructed.
 *
 * Every row owns a distinct digit `d ∈ 1..rows` and places `d` copies of it, so
 * the grand total of all columns is the fixed constant `Σ d²` (d = 1..rows). One
 * hidden total is therefore exactly recoverable as `Σ d² − (sum of the shown
 * totals)`: hiding it costs the player a deduction but removes no information, so
 * the solver and rater treat it as a normal (reconstructed) constraint. With no
 * hidden total the input is returned unchanged.
 */
export function effectiveTotals(inst: YakusoInstance): number[] {
  const { rows, totals } = inst;
  let known = 0;
  let hidden = -1;
  for (let c = 0; c < totals.length; c++) {
    const t = totals[c];
    if (t === null) hidden = c; else known += t;
  }
  if (hidden < 0) return totals as number[];
  let grand = 0;
  for (let d = 1; d <= rows; d++) grand += d * d;
  const out = totals.map((t) => t ?? 0);
  out[hidden] = grand - known;
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
  const { rows, cols } = inst;
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
  // Compare against the full totals, reconstructing the one hidden total.
  return effectiveTotals(inst).every((t, c) => t === sums[c]);
}

export function serializeInstance(inst: YakusoInstance): string { return JSON.stringify(inst); }
export function deserializeInstance(s: string): YakusoInstance { return JSON.parse(s) as YakusoInstance; }
export function serializeSolution(sol: YakusoSolution): string { return sol.join(','); }
export function deserializeSolution(s: string): YakusoSolution { return s.split(',').map(Number); }
