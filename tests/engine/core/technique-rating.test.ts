import { describe, it, expect } from 'vitest';
import {
  solveByTechniques,
  bumpBand,
  rateByTechniques,
  type Technique,
  type TechniqueRater
} from '../../../src/engine/core/technique-rating';

// Toy puzzle: a single number that must be driven from `start` up to `target` by
// applying "increment" techniques of escalating rank. Each technique adds 1 but
// only fires below a rank-specific ceiling, so the hardest rank used reflects how
// far the value had to climb.
interface Ctx { value: number; target: number }

function inc(name: string, rank: number, ceiling: number): Technique<Ctx> {
  return {
    name,
    rank,
    apply(ctx) {
      if (ctx.value >= ctx.target || ctx.value >= ceiling) return false;
      ctx.value += 1;
      return true;
    }
  };
}

const LADDER: Technique<Ctx>[] = [inc('r1', 1, 2), inc('r2', 2, 4), inc('r3', 3, 99)];
const isSolved = (c: Ctx) => c.value >= c.target;

describe('technique-rating framework', () => {
  it('uses the lowest-rank technique that still makes progress', () => {
    const t = solveByTechniques<Ctx>({ value: 0, target: 2 }, LADDER, isSolved);
    expect(t.solved).toBe(true);
    expect(t.hardestRank).toBe(1); // value 0->1->2 entirely via r1
  });

  it('escalates rank and counts steps at the hardest rank', () => {
    const t = solveByTechniques<Ctx>({ value: 0, target: 5 }, LADDER, isSolved);
    expect(t.solved).toBe(true);
    expect(t.hardestRank).toBe(3); // r1 to 2, r2 to 4, then r3 for the last step
    expect(t.topRankSteps).toBe(1); // exactly one r3 step (4->5)
  });

  it('reports unsolved when no technique makes progress', () => {
    const stuck: Technique<Ctx>[] = [inc('cap', 1, 0)];
    const t = solveByTechniques<Ctx>({ value: 0, target: 3 }, stuck, isSolved);
    expect(t.solved).toBe(false);
  });

  it('bumpBand moves up one band and saturates at expert', () => {
    expect(bumpBand('easy')).toBe('medium');
    expect(bumpBand('hard')).toBe('expert');
    expect(bumpBand('expert')).toBe('expert');
  });

  it('rateByTechniques returns expert when unsolved', () => {
    const rater: TechniqueRater<Ctx> = {
      ladder: [inc('cap', 1, 0)],
      isSolved,
      bandForRank: () => 'easy',
      topRankStepThreshold: 99
    };
    expect(rateByTechniques(rater, () => ({ value: 0, target: 3 }))).toBe('expert');
  });

  it('rateByTechniques bumps a band when top-rank steps exceed the threshold (rank >= 2 only)', () => {
    const rater: TechniqueRater<Ctx> = {
      ladder: LADDER,
      isSolved,
      bandForRank: (r) => (r <= 1 ? 'easy' : 'medium'),
      topRankStepThreshold: 1
    };
    // target 8: r3 fires for values 4->5->6->7->8 = 4 steps at rank 3 (>1) -> bump medium to hard
    expect(rateByTechniques(rater, () => ({ value: 0, target: 8 }))).toBe('hard');
  });

  it('rateByTechniques never bumps a rank-1 (singles-only) result', () => {
    const rater: TechniqueRater<Ctx> = {
      ladder: [inc('r1', 1, 99)],
      isSolved,
      bandForRank: () => 'easy',
      topRankStepThreshold: 1
    };
    // 50 rank-1 steps, but rank 1 is never bumped
    expect(rateByTechniques(rater, () => ({ value: 0, target: 50 }))).toBe('easy');
  });
});
