import { computeCandidates, PEERS, type Candidates } from './candidates';
import { nakedSingle, hiddenSingle, lockedCandidates, nakedPair, type Step } from './techniques';
import type { Difficulty } from '../../core/types';
import type { SudokuInstance } from './types';
import { measureEffort, type EffortModel } from '../../core/effort';
import { bandFromEffort } from '../../core/difficulty';

// Sudoku candidates: digits 1-9 not used by a filled peer.
const sudokuEffortModel: EffortModel = {
  cellCount: 81,
  candidates(grid, i) {
    if (grid[i] !== 0) return [];
    const used = new Set<number>();
    for (const p of PEERS[i]) if (grid[p] !== 0) used.add(grid[p]);
    const out: number[] = [];
    for (let d = 1; d <= 9; d++) if (!used.has(d)) out.push(d);
    return out;
  }
};

// Thresholds calibrated via distribution of 40 expert-dug puzzles (effort range 1–566):
// median=17, P75=48, P85=89. T1=2: effort≤2→medium; T2=48: effort≤48→hard, >48→expert.
export const SUDOKU_T1 = 2;
export const SUDOKU_T2 = 48;

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

/** Rate a puzzle by search effort (guesses needed by a forced-propagation + MRV solver). */
export function rate(instance: SudokuInstance): Difficulty {
  return bandFromEffort(measureEffort(instance.givens, sudokuEffortModel), SUDOKU_T1, SUDOKU_T2);
}
