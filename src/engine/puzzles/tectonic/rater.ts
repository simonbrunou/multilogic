import {
  makeCtx,
  nakedSingle,
  hiddenSingleRegion,
  nakedPairRegion,
  kingPointing,
  type TectonicCtx
} from './techniques';
import type { TectonicInstance } from './types';
import type { Difficulty } from '../../core/types';
import {
  rateByTechniques,
  solveByTechniques,
  type Technique,
  type TechniqueRater,
  type TechniqueTrace
} from '../../core/technique-rating';

// Ranks: naked single 1, hidden single 2, naked pair 3, king-pointing 4.
// Tectonic has no rows/columns — techniques use region-uniqueness + king adjacency.
const LADDER: Technique<TectonicCtx>[] = [
  { name: 'nakedSingle', rank: 1, apply: nakedSingle },
  { name: 'hiddenSingleRegion', rank: 2, apply: hiddenSingleRegion },
  { name: 'nakedPairRegion', rank: 3, apply: nakedPairRegion },
  { name: 'kingPointing', rank: 4, apply: kingPointing }
];

const isSolved = (ctx: TectonicCtx) => ctx.grid.every((v) => v !== 0);

function bandForRank(rank: number): Difficulty {
  if (rank <= 1) return 'easy';
  if (rank <= 2) return 'medium';
  if (rank <= 4) return 'hard';
  return 'expert';
}

const tectonicRater: TechniqueRater<TectonicCtx> = {
  ladder: LADDER,
  isSolved,
  bandForRank,
  topRankStepThreshold: 3
};

/** Solve as far as the technique ladder allows; report solved + hardest rank + steps at that rank. */
export function solveWithTechniques(inst: TectonicInstance): TechniqueTrace {
  return solveByTechniques(makeCtx(inst), LADDER, isSolved);
}

/** Rate a Tectonic by the hardest king-aware technique it requires (unsolved by ladder ⇒ expert). */
export function rate(inst: TectonicInstance): Difficulty {
  return rateByTechniques(tectonicRater, () => makeCtx(inst));
}
