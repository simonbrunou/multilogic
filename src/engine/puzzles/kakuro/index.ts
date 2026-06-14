import type { DeductionPuzzle, GenArgs, GenResult, SolveResult, MoveResult, RenderModel, Difficulty } from '../../core/types';
import type { KakuroInstance, KakuroState, KakuroMove, KakuroSolution } from './types';
import { serializeInstance, deserializeInstance, serializeSolution, deserializeSolution } from './rules';
import { solveComplete as solve } from './solver';
import { rate as rateInstance } from './rater';
import { getHint as hint } from './hint';
import { generateForDifficulty } from './generator';

function validateMove(inst: KakuroInstance, _s: KakuroState, m: KakuroMove): MoveResult {
  if (m.index < 0 || m.index >= inst.black.length) return { ok: false, reason: 'index out of range' };
  if (inst.black[m.index]) return { ok: false, reason: 'cell is a wall' };
  if (m.value !== 0 && (m.value < 1 || m.value > 9)) return { ok: false, reason: 'value must be 1-9' };
  return { ok: true };
}

function render(inst: KakuroInstance, state: KakuroState): RenderModel {
  return { kind: 'kakuro', width: inst.width, height: inst.height, black: inst.black, clues: inst.clues, cells: state.cells };
}

export const kakuro: DeductionPuzzle<KakuroInstance, KakuroState, KakuroMove, KakuroSolution> = {
  type: 'kakuro',
  kind: 'deduction',
  async generate(args: GenArgs): Promise<GenResult<KakuroInstance, KakuroSolution>> {
    if (args.signal.aborted) throw new Error('generation aborted');
    const g = generateForDifficulty(args.prng, args.difficulty);
    return { instance: g.instance, solution: g.solution, achievedDifficulty: g.difficulty, source: 'live' };
  },
  solveComplete(inst: KakuroInstance, limit = 2): SolveResult<KakuroSolution> { return solve(inst, limit); },
  rate(inst: KakuroInstance): Difficulty { return rateInstance(inst); },
  getHint: hint,
  validateMove,
  render,
  serializeInstance,
  deserializeInstance,
  serializeSolution,
  deserializeSolution
};
