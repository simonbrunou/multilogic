import type { DeductionPuzzle, GenArgs, GenResult, SolveResult, MoveResult, RenderModel, Difficulty } from '../../core/types';
import type { YakusoInstance, YakusoState, YakusoMove, YakusoSolution } from './types';
import { generateWithFallback } from '../../core/generate';
import { serializeInstance, deserializeInstance, serializeSolution, deserializeSolution } from './rules';
import { solveComplete as solve } from './solver';
import { rate as rateInstance } from './rater';
import { getHint as hint } from './hint';
import { generateForDifficulty } from './generator';

function validateMove(inst: YakusoInstance, _s: YakusoState, m: YakusoMove): MoveResult {
  if (m.index < 0 || m.index >= inst.rows * inst.cols) return { ok: false, reason: 'index out of range' };
  if (inst.clues[m.index] !== null) return { ok: false, reason: 'cell is a given' };
  if (m.value !== 0 && (m.value < 1 || m.value > inst.rows)) return { ok: false, reason: `value must be 0-${inst.rows}` };
  return { ok: true };
}

function render(inst: YakusoInstance, state: YakusoState): RenderModel {
  return { kind: 'yakuso', rows: inst.rows, cols: inst.cols, totals: inst.totals, clues: inst.clues, cells: state.cells };
}

export const yakuso: DeductionPuzzle<YakusoInstance, YakusoState, YakusoMove, YakusoSolution> = {
  type: 'yakuso',
  kind: 'deduction',
  async generate(args: GenArgs): Promise<GenResult<YakusoInstance, YakusoSolution>> {
    return generateWithFallback(args, generateForDifficulty);
  },
  solveComplete(inst: YakusoInstance, limit = 2): SolveResult<YakusoSolution> { return solve(inst, limit); },
  rate(inst: YakusoInstance): Difficulty { return rateInstance(inst); },
  getHint: hint,
  validateMove,
  render,
  serializeInstance,
  deserializeInstance,
  serializeSolution,
  deserializeSolution
};
