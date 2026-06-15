import { generateRegions } from './regions';
import { fill, solveComplete } from './solver';
import { rate } from './rater';
import type { PRNG } from '../../core/prng';
import type { Difficulty } from '../../core/types';
import type { TectonicInstance } from './types';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };
// Measured fill feasibility ~1.3%; guard of 2000 makes P(all-fail) < 1e-7.
const MAX_LAYOUT_ATTEMPTS = 2000;

export interface GeneratedTectonic { instance: TectonicInstance; solution: number[]; difficulty: Difficulty }

type Layout = { width: number; height: number; regions: number[] };

/** Remove every clue whose removal preserves a unique solution → the hardest minimal form. */
function digToMinimal(prng: PRNG, layout: Layout, solution: number[]): number[] {
  const givens = [...solution];
  for (const i of prng.shuffle(givens.map((_, k) => k))) {
    const saved = givens[i];
    givens[i] = 0;
    if (solveComplete({ ...layout, givens }, 2).count !== 1) givens[i] = saved;
  }
  return givens;
}

/** Add clues back (PRNG order) until the band drops to <= target. Terminates: full solution rates easy. */
function relaxToTarget(prng: PRNG, layout: Layout, minimal: number[], solution: number[], target: Difficulty): number[] {
  const givens = [...minimal];
  if (RANK[rate({ ...layout, givens })] <= RANK[target]) return givens;
  for (const i of prng.shuffle(givens.map((_, k) => k).filter((k) => givens[k] === 0))) {
    givens[i] = solution[i];
    if (RANK[rate({ ...layout, givens })] <= RANK[target]) break;
  }
  return givens;
}

export function generateForDifficulty(prng: PRNG, target: Difficulty, width = 5, height = 5): GeneratedTectonic {
  let regions = generateRegions(width, height, prng);
  let solution = fill({ width, height, regions, givens: new Array(width * height).fill(0) }, prng);
  let guard = 0;
  while (!solution && guard++ < MAX_LAYOUT_ATTEMPTS) {
    regions = generateRegions(width, height, prng);
    solution = fill({ width, height, regions, givens: new Array(width * height).fill(0) }, prng);
  }

  if (!solution) throw new Error('tectonic: failed to fill a region layout');

  const minimal = digToMinimal(prng, { width, height, regions }, solution);
  const givens = relaxToTarget(prng, { width, height, regions }, minimal, solution, target);
  const instance = { width, height, regions, givens };
  return { instance, solution, difficulty: rate(instance) };
}
