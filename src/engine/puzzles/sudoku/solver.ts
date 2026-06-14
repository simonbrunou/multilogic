import { buildDlx, gridFromSolution } from './rules';
import type { SudokuInstance, SudokuSolution } from './types';
import type { SolveResult } from '../../core/types';

/**
 * Uniqueness oracle: solve with a hard cap on solutions found.
 * `limit = 2` is the canonical uniqueness check (count === 1 ⇒ unique).
 */
export function solveComplete(
  instance: SudokuInstance,
  limit = 2
): SolveResult<SudokuSolution> {
  const dlx = buildDlx(instance.givens);
  const sols = dlx.solve(limit);
  return {
    count: sols.length,
    solution: sols.length > 0 ? gridFromSolution(sols[0]) : null
  };
}

/** Convenience: return the first solution (or null). */
export function solveOne(instance: SudokuInstance): SudokuSolution | null {
  return solveComplete(instance, 1).solution;
}
