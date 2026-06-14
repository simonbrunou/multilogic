import { computeCandidates, PEERS, type Candidates } from './candidates';
import { nakedSingle, hiddenSingle, lockedCandidates, nakedPair, type Step } from './techniques';
import type { Difficulty } from '../../core/types';
import type { SudokuInstance } from './types';

const LADDER: { fn: (g: number[], c: Candidates) => Step | null; rank: number }[] = [
  { fn: nakedSingle, rank: 1 },
  { fn: hiddenSingle, rank: 1 },
  { fn: lockedCandidates, rank: 2 },
  { fn: nakedPair, rank: 3 }
];

function apply(step: Step, grid: number[], cand: Candidates): void {
  for (const { index, digit } of step.placements) {
    grid[index] = digit;
    cand[index] = new Set<number>([digit]);
    for (const p of PEERS[index]) cand[p].delete(digit);
  }
  for (const { index, digit } of step.eliminations) cand[index].delete(digit);
}

export interface SolveTrace {
  solved: boolean;
  hardestRank: number;
}

/** Solve as far as the technique ladder allows; report whether solved + the hardest rank used. */
export function solveWithTechniques(givens: number[]): SolveTrace {
  const grid = [...givens];
  const cand = computeCandidates(grid);
  let hardestRank = 0;
  for (;;) {
    let progressed = false;
    for (const t of LADDER) {
      const step = t.fn(grid, cand);
      if (step) {
        apply(step, grid, cand);
        hardestRank = Math.max(hardestRank, t.rank);
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }
  return { solved: grid.every((v) => v !== 0), hardestRank };
}

/** Rate a puzzle by the hardest technique its solution path requires. */
export function rate(instance: SudokuInstance): Difficulty {
  const trace = solveWithTechniques(instance.givens);
  if (!trace.solved) return 'expert';
  if (trace.hardestRank <= 1) return 'easy';
  if (trace.hardestRank === 2) return 'medium';
  return 'hard';
}
