import { buildRunConstraints, runPermits, type RunConstraint } from './rules';
import type { KakuroInstance } from './types';
import type { Difficulty } from '../../core/types';
import { measureEffort, type EffortModel } from '../../core/effort';
import { bandFromEffort } from '../../core/difficulty';

// Thresholds calibrated via distribution of 40 expert-dug puzzles (effort range 0–4):
// median=1, P75=2, P85=3. T1=1: effort≤1→medium; T2=3: effort≤3→hard, >3→expert.
const KAKURO_T1 = 1;
const KAKURO_T2 = 3;


function candidate(grid: number[], i: number, v: number, runs: RunConstraint[], cellRuns: number[][]): boolean {
  for (const ri of cellRuns[i]) if (!runPermits(runs[ri], grid, i, v)) return false;
  return true;
}


function effortModel(inst: KakuroInstance): EffortModel {
  const { runs, cellRuns } = buildRunConstraints(inst);
  return {
    cellCount: inst.black.length,
    candidates(grid, i) {
      if (inst.black[i] || grid[i] !== 0) return [];
      const out: number[] = [];
      for (let v = 1; v <= 9; v++) if (candidate(grid, i, v, runs, cellRuns)) out.push(v);
      return out;
    }
  };
}

export function rate(inst: KakuroInstance): Difficulty {
  const start = inst.black.map((b) => (b ? -1 : 0));
  return bandFromEffort(measureEffort(start, effortModel(inst)), KAKURO_T1, KAKURO_T2);
}
