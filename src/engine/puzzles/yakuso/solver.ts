import type { YakusoInstance, YakusoSolution } from './types';
import type { SolveResult } from '../../core/types';
import { combinations, effectiveTotals } from './rules';

/** One way to fill a single row: own digit `d`, placed in columns `cols`. */
interface Placement { d: number; cols: number[] }

/** A row's clue constraints, parsed once. */
interface RowClues { pinned: number; forced: number[]; zero: Set<number>; contradictory: boolean }

/**
 * Parse the clues in row `r`: a non-zero clue pins the row's digit (and that
 * column must hold it); a `0` clue forbids placement in that column.
 */
function analyzeRowClues(inst: YakusoInstance, r: number): RowClues {
  const { cols, clues } = inst;
  const base = r * cols;
  let pinned = 0;
  const forced: number[] = [];
  const zero = new Set<number>();
  for (let c = 0; c < cols; c++) {
    const cl = clues[base + c];
    if (cl === null) continue;
    if (cl === 0) { zero.add(c); continue; }
    if (pinned !== 0 && pinned !== cl) return { pinned, forced, zero, contradictory: true };
    pinned = cl;
    forced.push(c);
  }
  return { pinned, forced, zero, contradictory: false };
}

/** Ways to place `d` copies of digit `d` in row `r`, given residual capacity and clues. */
function placementsForDigit(inst: YakusoInstance, totals: number[], r: number, d: number, colSum: number[], rc: RowClues): Placement[] {
  const { cols, clues } = inst;
  const base = r * cols;
  if (rc.forced.length > d) return [];
  if (rc.forced.some((c) => colSum[c] + d > totals[c])) return [];
  const free: number[] = [];
  for (let c = 0; c < cols; c++) {
    if (rc.forced.includes(c) || rc.zero.has(c) || clues[base + c] !== null) continue;
    if (colSum[c] + d <= totals[c]) free.push(c);
  }
  const need = d - rc.forced.length;
  if (need < 0 || need > free.length) return [];
  return combinations(free, need).map((combo) => ({ d, cols: [...rc.forced, ...combo] }));
}

/**
 * Viable fillings for row `r`. A row owning digit `d` places `d` copies of `d`;
 * a non-zero clue pins `d`; a `0` clue forbids that column. This is the single
 * source of YAKUSO's placement rule, shared by the uniqueness solver and the
 * effort-based rater (no drift).
 */
function rowPlacements(inst: YakusoInstance, totals: number[], r: number, colSum: number[], used: Set<number>): Placement[] {
  const rc = analyzeRowClues(inst, r);
  if (rc.contradictory) return [];
  const digits = rc.pinned !== 0 ? [rc.pinned] : [];
  if (rc.pinned === 0) for (let d = 1; d <= inst.rows; d++) if (!used.has(d)) digits.push(d);
  const out: Placement[] = [];
  for (const d of digits) {
    if (used.has(d)) continue;
    out.push(...placementsForDigit(inst, totals, r, d, colSum, rc));
  }
  return out;
}

/** Most-constrained unassigned row (MRV); `null` on a dead end (some row has no placement). */
function pickRow(inst: YakusoInstance, totals: number[], colSum: number[], used: Set<number>, assigned: boolean[]): { row: number; placements: Placement[] } | null {
  let bestRow = -1;
  let best: Placement[] | null = null;
  for (let r = 0; r < inst.rows; r++) {
    if (assigned[r]) continue;
    const ps = rowPlacements(inst, totals, r, colSum, used);
    if (ps.length === 0) return null;
    if (best === null || ps.length < best.length) { bestRow = r; best = ps; }
  }
  return best === null ? null : { row: bestRow, placements: best };
}

interface SearchResult { solutions: YakusoSolution[]; guesses: number }

/**
 * Backtracking search over rows with MRV ordering. Collects up to `limit`
 * solutions and, when `measure` is set, counts guess branches before the first
 * solution (the effort metric: forced rows cost nothing, branched rows cost one
 * per attempt). `effortCap` bounds the measured path — once the count exceeds it
 * the search stops, which already fixes the difficulty band. Uniqueness passes
 * `Infinity`.
 */
function search(inst: YakusoInstance, limit: number, measure: boolean, effortCap: number): SearchResult {
  const { rows, cols } = inst;
  // Reconstruct the one hidden total so the search runs against full column constraints.
  const totals = effectiveTotals(inst);
  const colSum = new Array<number>(cols).fill(0);
  const used = new Set<number>();
  const assigned = new Array<boolean>(rows).fill(false);
  const rowFill = new Array<Placement | null>(rows).fill(null);
  const solutions: YakusoSolution[] = [];
  let guesses = 0;
  let capped = false;

  const buildGrid = (): number[] => {
    const grid = new Array<number>(rows * cols).fill(0);
    for (let r = 0; r < rows; r++) for (const c of rowFill[r]!.cols) grid[r * cols + c] = rowFill[r]!.d;
    return grid;
  };
  const apply = (row: number, p: Placement): void => {
    assigned[row] = true; rowFill[row] = p; used.add(p.d);
    for (const c of p.cols) colSum[c] += p.d;
  };
  const undo = (row: number, p: Placement): void => {
    for (const c of p.cols) colSum[c] -= p.d;
    used.delete(p.d); rowFill[row] = null; assigned[row] = false;
  };

  const rec = (depth: number): void => {
    if (capped || solutions.length >= limit) return;
    if (depth === rows) {
      if (totals.every((t, c) => t === colSum[c])) solutions.push(buildGrid());
      return;
    }
    const choice = pickRow(inst, totals, colSum, used, assigned);
    if (!choice) return;
    const branched = choice.placements.length > 1;
    for (const p of choice.placements) {
      if (capped || solutions.length >= limit) return;
      if (measure && branched) { guesses++; if (guesses > effortCap) { capped = true; return; } }
      apply(choice.row, p);
      rec(depth + 1);
      undo(choice.row, p);
    }
  };

  rec(0);
  return { solutions, guesses };
}

/** Count solutions (up to `limit`) for the uniqueness check. */
export function solveComplete(inst: YakusoInstance, limit = 2): SolveResult<YakusoSolution> {
  const { solutions } = search(inst, limit, false, Infinity);
  return { count: solutions.length, solution: solutions.length ? solutions[0] : null };
}

/**
 * Guess-branches to reach the first solution; `Infinity` if unsolvable, `0` if
 * fully forced. When `cap` is given, the count is bounded to `cap + 1` (enough to
 * place the difficulty band) so rating a near-minimal grid stays cheap.
 */
export function effortToSolve(inst: YakusoInstance, cap = Infinity): number {
  const { solutions, guesses } = search(inst, 1, true, cap);
  return solutions.length || guesses > cap ? guesses : Infinity;
}
