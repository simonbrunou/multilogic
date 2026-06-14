import { generateRegions } from './regions';
import { fill, solveComplete } from './solver';
import { rate } from './rater';
import type { PRNG } from '../../core/prng';
import type { Difficulty } from '../../core/types';
import type { TectonicInstance } from './types';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };
const MAX_LAYOUT_ATTEMPTS = 200;

export interface GeneratedTectonic { instance: TectonicInstance; solution: number[]; difficulty: Difficulty }

export function generateForDifficulty(prng: PRNG, target: Difficulty, width = 5, height = 5): GeneratedTectonic {
  let regions = generateRegions(width, height, prng);
  let solution: number[] | null = null;

  for (let guard = 0; guard < MAX_LAYOUT_ATTEMPTS; guard++) {
    const inst = { width, height, regions, givens: new Array(width * height).fill(0) };
    // Quick feasibility check before committing to fill
    if (solveComplete(inst, 1).count > 0) {
      solution = fill(inst, prng);
      if (solution) break;
    }
    regions = generateRegions(width, height, prng);
  }

  if (!solution) throw new Error('tectonic: failed to fill a region layout');

  const givens = [...solution];
  const order = prng.shuffle(givens.map((_, i) => i));
  for (const i of order) {
    const saved = givens[i];
    givens[i] = 0;
    const inst = { width, height, regions, givens };
    if (solveComplete(inst, 2).count !== 1) { givens[i] = saved; continue; }
    if (RANK[rate(inst)] > RANK[target]) givens[i] = saved;
  }
  const instance = { width, height, regions, givens };
  return { instance, solution, difficulty: rate(instance) };
}
