import type { YakusoInstance, YakusoSolution } from './types';
import type { PRNG } from '../../core/prng';
import type { Difficulty } from '../../core/types';
import { columnSums } from './rules';
import { solveComplete } from './solver';
import { rate } from './rater';

export interface GeneratedYakuso { instance: YakusoInstance; solution: YakusoSolution; difficulty: Difficulty }

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };
/** R (interior rows) per difficulty; cols = R + 1. */
const ROWS: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 5, expert: 6 };

/** A random valid solution: a permutation of digits 1..R across rows, each placed d times. */
function randomSolution(prng: PRNG, rows: number, cols: number): number[] {
  const digits = prng.shuffle(Array.from({ length: rows }, (_, i) => i + 1));
  const grid = new Array<number>(rows * cols).fill(0);
  for (let r = 0; r < rows; r++) {
    const d = digits[r];
    const chosen = prng.shuffle(Array.from({ length: cols }, (_, c) => c)).slice(0, d);
    for (const c of chosen) grid[r * cols + c] = d;
  }
  return grid;
}

/**
 * Generate a unique YAKUSO instance for `target`.
 *
 * Build a known-valid solution, hide exactly one column total (it makes the grid
 * harder — the player must deduce that column's sum), then seed every interior
 * cell and dig: remove a seed only when the result stays uniquely solvable AND
 * does not rate harder than the target (so more-seeds-is-easier holds and
 * difficulty stays bounded). The hidden total is in force throughout, so the
 * uniqueness oracle and rater both account for it; the final instance is always
 * verified unique. `achievedDifficulty` is reported honestly by `rate`.
 */
export function generateForDifficulty(prng: PRNG, target: Difficulty): GeneratedYakuso {
  const rows = ROWS[target];
  const cols = rows + 1;
  const targetRank = RANK[target];

  for (let attempt = 0; attempt < 50; attempt++) {
    const solution = randomSolution(prng, rows, cols);
    // Hide one column's total from the player; the rest stay shown.
    const hidden = prng.int(cols);
    const totals: (number | null)[] = columnSums(solution, rows, cols).map((t, c) => (c === hidden ? null : t));
    const clues: (number | null)[] = [...solution];
    const full: YakusoInstance = { rows, cols, totals, clues: [...clues] };
    // Pre-dig base case: the fully-seeded instance must be unique (always true).
    if (solveComplete(full, 2).count !== 1) continue;

    for (const i of prng.shuffle(Array.from({ length: rows * cols }, (_, k) => k))) {
      if (clues[i] === null) continue;
      const saved = clues[i];
      clues[i] = null;
      const trial: YakusoInstance = { rows, cols, totals, clues: [...clues] };
      if (solveComplete(trial, 2).count !== 1 || RANK[rate(trial)] > targetRank) {
        clues[i] = saved; // removal breaks uniqueness or overshoots difficulty → keep the seed
      }
    }

    const instance: YakusoInstance = { rows, cols, totals, clues: [...clues] };
    return { instance, solution, difficulty: rate(instance) };
  }
  throw new Error('yakuso: failed to generate a unique puzzle');
}
