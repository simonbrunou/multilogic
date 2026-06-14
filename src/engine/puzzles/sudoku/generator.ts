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

/**
 * Generate a unique Sudoku by digging cells out of a full grid in PRNG order,
 * keeping a removal only if (a) the puzzle stays uniquely solvable and
 * (b) it does not push the difficulty above the target band.
 */
export function generateForDifficulty(prng: PRNG, target: Difficulty): GeneratedSudoku {
  const solution = generateFullGrid(prng);
  const givens = [...solution];
  const order = prng.shuffle([...Array(81)].map((_, i) => i));
  for (const i of order) {
    const saved = givens[i];
    givens[i] = 0;
    if (solveComplete({ givens }, 2).count !== 1) {
      givens[i] = saved;
      continue;
    }
    if (RANK[rate({ givens })] > RANK[target]) {
      givens[i] = saved;
    }
  }
  return { givens, solution, difficulty: rate({ givens }) };
}
