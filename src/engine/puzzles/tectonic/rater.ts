import { regionSizes, cellsByRegion, kingNeighbors } from './rules';
import type { TectonicInstance } from './types';
import type { Difficulty } from '../../core/types';
import { measureEffort, type EffortModel } from '../../core/effort';
import { bandFromEffort } from '../../core/difficulty';

function candidates(inst: TectonicInstance, grid: number[]): Set<number>[] {
  const sizes = regionSizes(inst);
  const byRegion = cellsByRegion(inst.regions);
  return grid.map((v, i) => {
    if (v !== 0) return new Set([v]);
    const size = sizes[inst.regions[i]];
    const banned = new Set<number>();
    for (const p of byRegion[inst.regions[i]]) if (grid[p] !== 0) banned.add(grid[p]);
    for (const k of kingNeighbors(i, inst.width, inst.height)) if (grid[k] !== 0) banned.add(grid[k]);
    const s = new Set<number>();
    for (let d = 1; d <= size; d++) if (!banned.has(d)) s.add(d);
    return s;
  });
}

function effortModel(inst: TectonicInstance): EffortModel {
  const sizes = regionSizes(inst);
  const byRegion = cellsByRegion(inst.regions);
  return {
    cellCount: inst.regions.length,
    candidates(grid, i) {
      if (grid[i] !== 0) return [];
      const size = sizes[inst.regions[i]];
      const banned = new Set<number>();
      for (const p of byRegion[inst.regions[i]]) if (grid[p] !== 0) banned.add(grid[p]);
      for (const k of kingNeighbors(i, inst.width, inst.height)) if (grid[k] !== 0) banned.add(grid[k]);
      const out: number[] = [];
      for (let d = 1; d <= size; d++) if (!banned.has(d)) out.push(d);
      return out;
    }
  };
}

export const TECTONIC_T1 = 1;
export const TECTONIC_T2 = 6;

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
