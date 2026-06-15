import { generateFullGrid } from './fullgrid';
import { solveComplete } from './solver';
import { rate } from './rater';
import type { PRNG } from '../../core/prng';
import type { SudokuGrid } from './types';
import type { Difficulty } from '../../core/types';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

export interface GeneratedSudoku {
  givens: SudokuGrid;
  solution: SudokuGrid;
  difficulty: Difficulty;
}

/** Remove every clue whose removal preserves a unique solution → the hardest (minimal) form of this grid. */
function digToMinimal(prng: PRNG, solution: SudokuGrid): SudokuGrid {
  const givens = [...solution];
  for (const i of prng.shuffle([...Array(81)].map((_, k) => k))) {
    const saved = givens[i];
    givens[i] = 0;
    if (solveComplete({ givens }, 2).count !== 1) givens[i] = saved;
  }
  return givens;
}

/**
 * Add removed clues back (in PRNG order) until the band drops to `target` or below.
 * Termination is guaranteed: the full solution rates `easy` (the solver is immediately
 * `isSolved`, hardestRank=0 -> band='easy'), so the loop reaches <= target no later than
 * the last clue. Individual additions may not monotonically lower the band (the
 * topRankSteps bump can raise it), but the exit check uses the true `rate()`, so the
 * <= target guarantee still holds.
 */
function relaxToTarget(prng: PRNG, minimal: SudokuGrid, solution: SudokuGrid, target: Difficulty): SudokuGrid {
  const givens = [...minimal];
  if (RANK[rate({ givens })] <= RANK[target]) return givens;
  const removed = prng.shuffle([...Array(81)].map((_, k) => k).filter((k) => givens[k] === 0));
  for (const i of removed) {
    givens[i] = solution[i];
    if (RANK[rate({ givens })] <= RANK[target]) break;
  }
  return givens;
}

/**
 * Generate a unique Sudoku aimed at `target`. Digs to the minimal (hardest) form, then
 * relaxes down to the target band. Guarantees `rate(givens) <= target`; hits `== target`
 * with high yield. The module loop (index.ts) retries seeds for an exact-band match.
 */
export function generateForDifficulty(prng: PRNG, target: Difficulty): GeneratedSudoku {
  const solution = generateFullGrid(prng);
  const minimal = digToMinimal(prng, solution);
  const givens = relaxToTarget(prng, minimal, solution, target);
  return { givens, solution, difficulty: rate({ givens }) };
}
