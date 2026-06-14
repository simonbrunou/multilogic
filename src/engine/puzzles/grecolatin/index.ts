import type { ConstructionPuzzle, GenArgs, GenResult, MoveResult, RenderModel, ConstructionResult } from '../../core/types';
import type { GrecoLatinInstance, GrecoLatinState, GrecoLatinMove, GrecoLatinSolution } from './types';
import { validateGrid, serializeInstance, deserializeInstance, serializeSolution, deserializeSolution } from './rules';
import { generateForDifficulty } from './generator';

function validate(inst: GrecoLatinInstance, state: GrecoLatinState): ConstructionResult {
  const grid = inst.givens.map((g, i) => (g !== 0 ? g : state.cells[i] || 0));
  const r = validateGrid(inst.n, grid);
  return { complete: r.complete, valid: r.valid, score: r.score };
}

function validateMove(inst: GrecoLatinInstance, _s: GrecoLatinState, m: GrecoLatinMove): MoveResult {
  if (m.index < 0 || m.index >= inst.n * inst.n) return { ok: false, reason: 'index out of range' };
  if (inst.givens[m.index] !== 0) return { ok: false, reason: 'cell is a given' };
  if (m.value !== 0 && (m.value < 1 || m.value > inst.n * inst.n)) return { ok: false, reason: 'invalid pair' };
  return { ok: true };
}

function render(inst: GrecoLatinInstance, state: GrecoLatinState): RenderModel {
  return { kind: 'grecolatin', n: inst.n, givens: inst.givens, cells: state.cells };
}

export const grecolatin: ConstructionPuzzle<GrecoLatinInstance, GrecoLatinState, GrecoLatinMove> = {
  type: 'grecolatin',
  kind: 'construction',
  async generate(args: GenArgs): Promise<GenResult<GrecoLatinInstance, GrecoLatinSolution>> {
    if (args.signal.aborted) throw new Error('generation aborted');
    const g = generateForDifficulty(args.prng, args.difficulty);
    return { instance: g.instance, solution: null, achievedDifficulty: g.difficulty, source: 'live' };
  },
  validate,
  validateMove,
  render,
  serializeInstance,
  deserializeInstance,
  serializeSolution,
  deserializeSolution,
};
