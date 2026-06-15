import { makeCtx, isSolved, forcedCell, forcedDigit, comboElimination, type KakuroCtx } from './techniques';
import type { KakuroInstance } from './types';
import type { Difficulty } from '../../core/types';
import {
  rateByTechniques,
  solveByTechniques,
  type Technique,
  type TechniqueRater,
  type TechniqueTrace
} from '../../core/technique-rating';

// Kakuro deduction is sum-combination reasoning. Ranks: forced cell 1, forced digit 2,
// combo-elimination 3. The difficulty distribution is bimodal (mostly easy or expert),
// so `medium` is rare and `hard` is served by the module's closest-fallback (see index.ts).
const LADDER: Technique<KakuroCtx>[] = [
  { name: 'forcedCell', rank: 1, apply: forcedCell },
  { name: 'forcedDigit', rank: 2, apply: forcedDigit },
  { name: 'comboElimination', rank: 3, apply: comboElimination }
];

function bandForRank(rank: number): Difficulty {
  if (rank <= 1) return 'easy';
  if (rank <= 2) return 'medium';
  return 'expert';
}

const kakuroRater: TechniqueRater<KakuroCtx> = {
  ladder: LADDER,
  isSolved,
  bandForRank,
  // Disable the step-count bump: Kakuro is honestly ~2-band; don't fabricate tiers from step counts.
  topRankStepThreshold: Number.MAX_SAFE_INTEGER
};

/** Solve as far as the technique ladder allows; report solved + hardest rank + steps at that rank. */
export function solveWithTechniques(inst: KakuroInstance): TechniqueTrace {
  return solveByTechniques(makeCtx(inst), LADDER, isSolved);
}

/** Rate a Kakuro by the hardest sum-combination technique it requires (unsolved by ladder ⇒ expert). */
export function rate(inst: KakuroInstance): Difficulty {
  return rateByTechniques(kakuroRater, () => makeCtx(inst));
}
