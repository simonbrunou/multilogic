import type {
  DeductionPuzzle,
  GenArgs,
  GenResult,
  SolveResult,
  MoveResult,
  RenderModel,
  Difficulty
} from '../../core/types';
import type { SudokuInstance, SudokuState, SudokuMove, SudokuSolution } from './types';
import { solveComplete as solve } from './solver';
import { rate as rateInstance } from './rater';
import { getHint as hint } from './hint';
import { generateForDifficulty, type GeneratedSudoku } from './generator';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };
const MAX_ATTEMPTS = 8;

function validateMove(instance: SudokuInstance, _state: SudokuState, move: SudokuMove): MoveResult {
  if (instance.givens[move.index] !== 0) return { ok: false, reason: 'cell is a given' };
  if (move.value !== 0 && (move.value < 1 || move.value > 9)) {
    return { ok: false, reason: 'value must be 1-9' };
  }
  return { ok: true };
}

function render(instance: SudokuInstance, state: SudokuState): RenderModel {
  return { kind: 'grid9', givens: instance.givens, cells: state.cells };
}

function closerTo(target: Difficulty, a: GeneratedSudoku, b: GeneratedSudoku): GeneratedSudoku {
  const da = Math.abs(RANK[a.difficulty] - RANK[target]);
  const db = Math.abs(RANK[b.difficulty] - RANK[target]);
  return db < da ? b : a;
}

export const sudoku: DeductionPuzzle<SudokuInstance, SudokuState, SudokuMove, SudokuSolution> = {
  type: 'sudoku',
  kind: 'deduction',

  async generate(args: GenArgs): Promise<GenResult<SudokuInstance, SudokuSolution>> {
    let closest: GeneratedSudoku | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (args.signal.aborted) throw new Error('generation aborted');
      const g = generateForDifficulty(args.prng, args.difficulty);
      if (g.difficulty === args.difficulty) {
        return { instance: { givens: g.givens }, solution: g.solution, achievedDifficulty: g.difficulty, source: 'live' };
      }
      closest = closest ? closerTo(args.difficulty, closest, g) : g;
    }
    return {
      instance: { givens: closest!.givens },
      solution: closest!.solution,
      achievedDifficulty: closest!.difficulty,
      source: 'live'
    };
  },

  solveComplete(instance: SudokuInstance, limit = 2): SolveResult<SudokuSolution> {
    return solve(instance, limit);
  },

  rate(instance: SudokuInstance): Difficulty {
    return rateInstance(instance);
  },

  getHint: hint,
  validateMove,
  render
};
