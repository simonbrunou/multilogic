import { regionSizes, cellsByRegion, cellCandidates } from './rules';
import type { TectonicInstance } from './types';
import type { Difficulty } from '../../core/types';
import { measureEffort, type EffortModel } from '../../core/effort';
import { bandFromEffort } from '../../core/difficulty';

function candidates(inst: TectonicInstance, grid: number[]): Set<number>[] {
  const sizes = regionSizes(inst);
  const byRegion = cellsByRegion(inst.regions);
  return grid.map((v, i) =>
    v !== 0 ? new Set([v]) : new Set(cellCandidates(inst, grid, i, sizes, byRegion))
  );
}

function effortModel(inst: TectonicInstance): EffortModel {
  const sizes = regionSizes(inst);
  const byRegion = cellsByRegion(inst.regions);
  return {
    cellCount: inst.regions.length,
    candidates(grid, i) {
      return grid[i] !== 0 ? [] : cellCandidates(inst, grid, i, sizes, byRegion);
    }
  };
}

// Thresholds calibrated via distribution of 40 expert-dug puzzles (effort range 0–44):
// median=5, P75=10, P85=13. T1=2: effort≤2→medium; T2=10: effort≤10→hard, >10→expert.
const TECTONIC_T1 = 2;
const TECTONIC_T2 = 10;

export interface Trace { solved: boolean; hardestRank: number }

/** Naked single (rank 1), hidden single in region (rank 2). */
export function solveWithTechniques(inst: TectonicInstance): Trace {
  const grid = [...inst.givens];
  const byRegion = cellsByRegion(inst.regions);
  let hardestRank = 0;
  for (;;) {
    const cand = candidates(inst, grid);
    let progressed = false;
    for (let i = 0; i < grid.length && !progressed; i++) {
      if (grid[i] === 0 && cand[i].size === 1) { grid[i] = [...cand[i]][0]; hardestRank = Math.max(hardestRank, 1); progressed = true; }
    }
    if (progressed) continue;
    for (const cells of Object.values(byRegion)) {
      const size = cells.length;
      for (let d = 1; d <= size && !progressed; d++) {
        const spots = cells.filter((i) => grid[i] === 0 && cand[i].has(d));
        if (spots.length === 1) { grid[spots[0]] = d; hardestRank = Math.max(hardestRank, 2); progressed = true; }
      }
      if (progressed) break;
    }
    if (!progressed) break;
  }
  return { solved: grid.every((v) => v !== 0), hardestRank };
}

export function rate(inst: TectonicInstance): Difficulty {
  return bandFromEffort(measureEffort(inst.givens, effortModel(inst)), TECTONIC_T1, TECTONIC_T2);
}
