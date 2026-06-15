import { DIFFICULTIES, type Difficulty } from './types';

/** One deduction technique over a mutable solving context. */
export interface Technique<Ctx> {
  name: string;
  rank: number;
  /** Apply once. Return true iff it changed the context (placed a value or removed >= 1 candidate). */
  apply(ctx: Ctx): boolean;
}

/** Everything needed to turn a solve trace into a difficulty band for one puzzle type. */
export interface TechniqueRater<Ctx> {
  ladder: Technique<Ctx>[];
  isSolved(ctx: Ctx): boolean;
  bandForRank(rank: number): Difficulty;
  /** Bump one band when the count of steps at the hardest rank exceeds this (rank >= 2 only). */
  topRankStepThreshold: number;
}

export interface TechniqueTrace {
  solved: boolean;
  /** Highest technique rank ever used (0 if no technique fired). */
  hardestRank: number;
  /** Number of steps taken at `hardestRank`. */
  topRankSteps: number;
}

/**
 * Repeatedly apply the lowest-rank technique that makes progress, restarting the
 * scan from rank 1 after each step. Tracks the hardest rank used and how many
 * steps were taken at that rank. Terminates when no technique progresses.
 */
export function solveByTechniques<Ctx>(
  ctx: Ctx,
  ladder: Technique<Ctx>[],
  isSolved: (ctx: Ctx) => boolean
): TechniqueTrace {
  let hardestRank = 0;
  const stepsAtRank = new Map<number, number>();
  for (;;) {
    let progressed = false;
    for (const t of ladder) {
      if (t.apply(ctx)) {
        hardestRank = Math.max(hardestRank, t.rank);
        stepsAtRank.set(t.rank, (stepsAtRank.get(t.rank) ?? 0) + 1);
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }
  return { solved: isSolved(ctx), hardestRank, topRankSteps: stepsAtRank.get(hardestRank) ?? 0 };
}

/** Next harder band, saturating at `expert`. */
export function bumpBand(band: Difficulty): Difficulty {
  const i = DIFFICULTIES.indexOf(band);
  return DIFFICULTIES[Math.min(i + 1, DIFFICULTIES.length - 1)];
}

/**
 * Rate a puzzle: band of the hardest required technique, bumped one band when many
 * steps were needed at that rank (rank >= 2 only — step count at rank 1 just tracks
 * grid emptiness, not difficulty). Unsolved by the ladder ⇒ `expert`.
 */
export function rateByTechniques<Ctx>(rater: TechniqueRater<Ctx>, makeCtx: () => Ctx): Difficulty {
  const trace = solveByTechniques(makeCtx(), rater.ladder, rater.isSolved);
  if (!trace.solved) return 'expert';
  let band = rater.bandForRank(trace.hardestRank);
  if (trace.hardestRank >= 2 && trace.topRankSteps > rater.topRankStepThreshold) band = bumpBand(band);
  return band;
}
