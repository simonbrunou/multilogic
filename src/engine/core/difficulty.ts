import type { Difficulty } from './types';

/** Map a search-effort count to a difficulty band. effort 0 ⇒ easy; ≤t1 ⇒ medium; ≤t2 ⇒ hard; else expert. */
export function bandFromEffort(effort: number, t1: number, t2: number): Difficulty {
  if (effort <= 0) return 'easy';
  if (effort <= t1) return 'medium';
  if (effort <= t2) return 'hard';
  return 'expert';
}
