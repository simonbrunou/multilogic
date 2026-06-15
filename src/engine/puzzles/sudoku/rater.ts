import { computeCandidates, PEERS, type Candidates } from './candidates';
import {
  nakedSingle,
  hiddenSingle,
  lockedCandidates,
  nakedPair,
  hiddenPair,
  nakedTriple,
  hiddenTriple,
  xWing,
  type Step
} from './techniques';
import type { Difficulty } from '../../core/types';
import type { SudokuInstance } from './types';
import {
  rateByTechniques,
  solveByTechniques,
  type Technique,
  type TechniqueRater,
  type TechniqueTrace
} from '../../core/technique-rating';

interface SudokuCtx {
  grid: number[];
  cand: Candidates;
}

/** Apply a technique step to the context: place digits (and prune peers) or remove candidates. */
function applyStep(step: Step, ctx: SudokuCtx): void {
  for (const { index, digit } of step.placements) {
    ctx.grid[index] = digit;
    ctx.cand[index] = new Set<number>([digit]);
    for (const p of PEERS[index]) ctx.cand[p].delete(digit);
  }
  for (const { index, digit } of step.eliminations) ctx.cand[index].delete(digit);
}

/** Wrap a pure (grid, cand) -> Step|null technique as a framework Technique. */
function wrap(name: string, rank: number, fn: (g: number[], c: Candidates) => Step | null): Technique<SudokuCtx> {
  return {
    name,
    rank,
    apply(ctx) {
      const step = fn(ctx.grid, ctx.cand);
      if (!step) return false;
      applyStep(step, ctx);
      return true;
    }
  };
}

// Ranks: singles 1, locked candidates 2, naked/hidden pair 3, naked/hidden triple 4, X-wing 5.
// Anything the ladder cannot solve is `expert` (needs a technique harder than X-wing, or a guess).
const LADDER: Technique<SudokuCtx>[] = [
  wrap('nakedSingle', 1, nakedSingle),
  wrap('hiddenSingle', 1, hiddenSingle),
  wrap('lockedCandidates', 2, lockedCandidates),
  wrap('nakedPair', 3, nakedPair),
  wrap('hiddenPair', 3, hiddenPair),
  wrap('nakedTriple', 4, nakedTriple),
  wrap('hiddenTriple', 4, hiddenTriple),
  wrap('xWing', 5, xWing)
];

function bandForRank(rank: number): Difficulty {
  if (rank <= 1) return 'easy';
  if (rank <= 2) return 'medium';
  if (rank <= 4) return 'hard';
  return 'expert';
}

const isSolved = (ctx: SudokuCtx) => ctx.grid.every((v) => v !== 0);
const makeCtx = (givens: number[]): SudokuCtx => {
  const grid = [...givens];
  return { grid, cand: computeCandidates(grid) };
};

const sudokuRater: TechniqueRater<SudokuCtx> = {
  ladder: LADDER,
  isSolved,
  bandForRank,
  // Bump one band when the hardest rank (>= 2) had to be used more than this many times.
  topRankStepThreshold: 4
};

/** Solve as far as the technique ladder allows; report solved + hardest rank + steps at that rank. */
export function solveWithTechniques(givens: number[]): TechniqueTrace {
  return solveByTechniques(makeCtx(givens), LADDER, isSolved);
}

/** Rate a Sudoku by the hardest human technique it requires (unsolved by ladder ⇒ expert). */
export function rate(instance: SudokuInstance): Difficulty {
  return rateByTechniques(sudokuRater, () => makeCtx(instance.givens));
}
