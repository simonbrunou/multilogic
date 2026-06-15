import type { Difficulty, GenArgs, GenResult } from './types';
import type { PRNG } from './prng';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

export interface Generated<Instance, Solution> {
  instance: Instance;
  solution: Solution;
  difficulty: Difficulty;
}

function toResult<I, S>(g: Generated<I, S>): GenResult<I, S> {
  return { instance: g.instance, solution: g.solution, achievedDifficulty: g.difficulty, source: 'live' };
}

/**
 * Drive a deduction puzzle's difficulty fallback: run `gen` up to `maxAttempts`
 * times, returning the first instance that hits the requested difficulty, else
 * the closest achieved one. Honest `achievedDifficulty` is reported either way.
 * Throws only if generation throws on the final fallback attempt.
 */
export function generateWithFallback<I, S>(
  args: GenArgs,
  gen: (prng: PRNG, difficulty: Difficulty) => Generated<I, S>,
  maxAttempts = 12
): GenResult<I, S> {
  let best: Generated<I, S> | null = null;
  for (let a = 0; a < maxAttempts; a++) {
    if (args.signal.aborted) throw new Error('generation aborted');
    let g: Generated<I, S>;
    try {
      g = gen(args.prng, args.difficulty);
    } catch {
      continue;
    }
    if (g.difficulty === args.difficulty) return toResult(g);
    const closer = best === null || Math.abs(RANK[g.difficulty] - RANK[args.difficulty]) < Math.abs(RANK[best.difficulty] - RANK[args.difficulty]);
    if (closer) best = g;
  }
  return toResult(best ?? gen(args.prng, args.difficulty));
}
