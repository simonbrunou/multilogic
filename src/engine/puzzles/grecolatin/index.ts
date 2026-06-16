import type { ConstructionPuzzle, GenArgs, GenResult, MoveResult, RenderModel, ConstructionResult, Hint } from '../../core/types';
import type { GrecoLatinInstance, GrecoLatinState, GrecoLatinMove, GrecoLatinSolution } from './types';
import { validateGrid, serializeInstance, deserializeInstance, serializeSolution, deserializeSolution } from './rules';
import { generateForDifficulty } from './generator';
import { getHint as hint } from './hint';

function mergedCells(inst: GrecoLatinInstance, state: GrecoLatinState): number[] {
  const n = inst.n;
  return Array.from({ length: n * n }, (_, i) => {
    const a = inst.digitClues[i] !== null ? inst.digitClues[i] : null;
    const b = inst.letterClues[i] !== null ? inst.letterClues[i] : null;
    const v = state.cells[i] || 0;
    const pa = a !== null ? a : v !== 0 ? Math.floor((v - 1) / n) : null;
    const pb = b !== null ? b : v !== 0 ? (v - 1) % n : null;
    return pa !== null && pb !== null ? pa * n + pb + 1 : 0;
  });
}

function validate(inst: GrecoLatinInstance, state: GrecoLatinState): ConstructionResult {
  const r = validateGrid(inst.n, mergedCells(inst, state));
  return { complete: r.complete, valid: r.valid, score: r.score };
}

function validateMove(inst: GrecoLatinInstance, _s: GrecoLatinState, m: GrecoLatinMove): MoveResult {
  if (m.index < 0 || m.index >= inst.n * inst.n) return { ok: false, reason: 'index out of range' };
  if (inst.digitClues[m.index] !== null && inst.letterClues[m.index] !== null) return { ok: false, reason: 'cell is fully given' };
  if (m.value !== 0 && (m.value < 1 || m.value > inst.n * inst.n)) return { ok: false, reason: 'invalid pair' };
  return { ok: true };
}

function render(inst: GrecoLatinInstance, state: GrecoLatinState): RenderModel {
  return { kind: 'grecolatin', n: inst.n, digitClues: inst.digitClues, letterClues: inst.letterClues, cells: state.cells };
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
  getHint(inst: GrecoLatinInstance, state: GrecoLatinState): Hint | null { return hint(inst, state); },
  render,
  serializeInstance,
  deserializeInstance,
  serializeSolution,
  deserializeSolution,
};
