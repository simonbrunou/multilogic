import type { DeductionPuzzle, GenArgs, GenResult, SolveResult, MoveResult, RenderModel, Difficulty } from '../../core/types';
import type { TectonicInstance, TectonicState, TectonicMove, TectonicSolution } from './types';
import { regionSizes, serializeInstance, deserializeInstance, serializeSolution, deserializeSolution } from './rules';
import { solveComplete as solve } from './solver';
import { rate as rateInstance } from './rater';
import { getHint as hint } from './hint';
import { generateForDifficulty, type GeneratedTectonic } from './generator';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };
const MAX_ATTEMPTS = 6;

function validateMove(inst: TectonicInstance, _s: TectonicState, m: TectonicMove): MoveResult {
  if (m.index < 0 || m.index >= inst.regions.length) return { ok: false, reason: 'index out of range' };
  if (inst.givens[m.index] !== 0) return { ok: false, reason: 'cell is a given' };
  if (m.value !== 0) {
    const size = regionSizes(inst)[inst.regions[m.index]];
    if (m.value < 1 || m.value > size) return { ok: false, reason: `value must be 1-${size}` };
  }
  return { ok: true };
}

function render(inst: TectonicInstance, state: TectonicState): RenderModel {
  return { kind: 'tectonic', width: inst.width, height: inst.height, regions: inst.regions, givens: inst.givens, cells: state.cells };
}

function closer(target: Difficulty, a: GeneratedTectonic, b: GeneratedTectonic): GeneratedTectonic {
  return Math.abs(RANK[b.difficulty] - RANK[target]) < Math.abs(RANK[a.difficulty] - RANK[target]) ? b : a;
}

export const tectonic: DeductionPuzzle<TectonicInstance, TectonicState, TectonicMove, TectonicSolution> = {
  type: 'tectonic',
  kind: 'deduction',
  async generate(args: GenArgs): Promise<GenResult<TectonicInstance, TectonicSolution>> {
    let best: GeneratedTectonic | null = null;
    for (let a = 0; a < MAX_ATTEMPTS; a++) {
      if (args.signal.aborted) throw new Error('generation aborted');
      let g: GeneratedTectonic;
      try {
        g = generateForDifficulty(args.prng, args.difficulty);
      } catch {
        continue;
      }
      if (g.difficulty === args.difficulty) return { instance: g.instance, solution: g.solution, achievedDifficulty: g.difficulty, source: 'live' };
      best = best ? closer(args.difficulty, best, g) : g;
    }
    if (best) return { instance: best.instance, solution: best.solution, achievedDifficulty: best.difficulty, source: 'live' };
    // Every attempt threw — let this surface as a genuine error.
    const g = generateForDifficulty(args.prng, args.difficulty);
    return { instance: g.instance, solution: g.solution, achievedDifficulty: g.difficulty, source: 'live' };
  },
  solveComplete(inst: TectonicInstance, limit = 2): SolveResult<TectonicSolution> { return solve(inst, limit); },
  rate(inst: TectonicInstance): Difficulty { return rateInstance(inst); },
  getHint: hint,
  validateMove,
  render,
  serializeInstance,
  deserializeInstance,
  serializeSolution,
  deserializeSolution
};
