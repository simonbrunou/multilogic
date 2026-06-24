import type { YakusoInstance, YakusoSolution } from './types';

/** Column sums of a flat `rows*cols` grid. */
export function columnSums(grid: number[], rows: number, cols: number): number[] {
  const out = new Array<number>(cols).fill(0);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out[c] += grid[r * cols + c];
  return out;
}

/**
 * The fixed grand total of every column: every row owns a distinct digit
 * `d ∈ 1..rows` and places `d` copies of it, so the sum of all columns is the
 * constant `Σ d²` (d = 1..rows), independent of the layout.
 */
function grandTotal(rows: number): number {
  let grand = 0;
  for (let d = 1; d <= rows; d++) grand += d * d;
  return grand;
}

/** Sum of the column totals shown to the player (the non-`null` entries). */
function shownTotal(totals: (number | null)[]): number {
  let shown = 0;
  for (const t of totals) if (t !== null) shown += t;
  return shown;
}

/**
 * Per-column upper bound for the solver, rater and conflict checks. A shown
 * total caps its own column exactly; a hidden column (`null`) is capped by the
 * **joint hidden budget** `Σ d² − (shown totals)` — the most any one hidden
 * column could hold, since the hidden columns are non-negative and together sum
 * to that budget. With a single hidden column the cap equals its true total
 * (the budget *is* that column), so this generalizes the old reconstruction.
 */
export function totalCaps(inst: YakusoInstance): number[] {
  const budget = grandTotal(inst.rows) - shownTotal(inst.totals);
  return inst.totals.map((t) => t ?? budget);
}

/**
 * Whether the column sums `sums` satisfy `inst`'s totals: every shown total is
 * matched exactly, and the hidden columns collectively sum to the hidden budget
 * `Σ d² − (shown totals)`. With one hidden column this pins that column's value
 * exactly; with several it is a joint constraint (the individual hidden sums
 * stay ambiguous, which is what makes more hidden totals harder).
 */
export function totalsSatisfied(inst: YakusoInstance, sums: number[]): boolean {
  const { rows, totals } = inst;
  let hiddenSum = 0;
  for (let c = 0; c < totals.length; c++) {
    const t = totals[c];
    if (t === null) hiddenSum += sums[c];
    else if (sums[c] !== t) return false;
  }
  return hiddenSum === grandTotal(rows) - shownTotal(totals);
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
  // Shown totals must match exactly; the hidden columns must sum to the budget.
  return totalsSatisfied(inst, sums);
}

export function serializeInstance(inst: YakusoInstance): string { return JSON.stringify(inst); }
export function deserializeInstance(s: string): YakusoInstance { return JSON.parse(s) as YakusoInstance; }
export function serializeSolution(sol: YakusoSolution): string { return sol.join(','); }
export function deserializeSolution(s: string): YakusoSolution { return s.split(',').map(Number); }
