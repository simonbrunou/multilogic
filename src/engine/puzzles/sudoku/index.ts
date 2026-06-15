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
import { generateForDifficulty } from './generator';
import { gridFromString, gridToString } from './rules';

const MAX_ATTEMPTS = 60;

function validateMove(instance: SudokuInstance, _state: SudokuState, move: SudokuMove): MoveResult {
  if (move.index < 0 || move.index > 80) return { ok: false, reason: 'index out of range' };
  if (instance.givens[move.index] !== 0) return { ok: false, reason: 'cell is a given' };
  if (move.value !== 0 && (move.value < 1 || move.value > 9)) {
    return { ok: false, reason: 'value must be 1-9' };
  }
  return { ok: true };
}

function render(instance: SudokuInstance, state: SudokuState): RenderModel {
  return { kind: 'grid9', givens: instance.givens, cells: state.cells };
}

export const sudoku: DeductionPuzzle<SudokuInstance, SudokuState, SudokuMove, SudokuSolution> = {
  type: 'sudoku',
  kind: 'deduction',

  async generate(args: GenArgs): Promise<GenResult<SudokuInstance, SudokuSolution>> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (args.signal.aborted) throw new Error('generation aborted');
      const g = generateForDifficulty(args.prng, args.difficulty);
      if (g.difficulty === args.difficulty) {
        return { instance: { givens: g.givens }, solution: g.solution, achievedDifficulty: g.difficulty, source: 'live' };
      }
    }
    throw new Error(`could not generate sudoku at ${args.difficulty} within ${MAX_ATTEMPTS} attempts`);
  },

  solveComplete(instance: SudokuInstance, limit = 2): SolveResult<SudokuSolution> {
    return solve(instance, limit);
  },

  rate(instance: SudokuInstance): Difficulty {
    return rateInstance(instance);
  },

  getHint: hint,
  validateMove,
  render,
  serializeInstance: (i: SudokuInstance) => gridToString(i.givens),
  deserializeInstance: (s: string): SudokuInstance => ({ givens: gridFromString(s) }),
  serializeSolution: (sol: SudokuSolution) => gridToString(sol),
  deserializeSolution: (s: string): SudokuSolution => gridFromString(s)
};
