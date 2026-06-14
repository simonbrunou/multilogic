import { horizontalRuns, verticalRuns } from './rules';
import type { KakuroInstance } from './types';
import type { Difficulty } from '../../core/types';
import { measureEffort, type EffortModel } from '../../core/effort';
import { bandFromEffort } from '../../core/difficulty';

export const KAKURO_T1 = 1;
export const KAKURO_T2 = 8;

interface Constraint { cells: number[]; target: number | null }

function constraints(inst: KakuroInstance): { runs: Constraint[]; cellRuns: number[][] } {
  const runs: Constraint[] = [];
  const cellRuns: number[][] = inst.black.map(() => []);
  const add = (cells: number[], sum: number | undefined) => {
    if (!cells.length) return;
    const idx = runs.length;
    runs.push({ cells, target: sum ?? null });
    for (const c of cells) cellRuns[c].push(idx);
  };
  for (const r of horizontalRuns(inst.width, inst.height, inst.black)) add(r.cells, r.clueIndex >= 0 ? inst.clues[r.clueIndex]?.right : undefined);
  for (const r of verticalRuns(inst.width, inst.height, inst.black)) add(r.cells, r.clueIndex >= 0 ? inst.clues[r.clueIndex]?.down : undefined);
  return { runs, cellRuns };
}

function candidate(grid: number[], i: number, v: number, runs: Constraint[], cellRuns: number[][]): boolean {
  for (const ri of cellRuns[i]) {
    const run = runs[ri];
    let filled = 0, remaining = 0;
    for (const c of run.cells) { const val = c === i ? v : grid[c]; if (val === v && c !== i) return false; if (val !== 0) filled += val; else remaining++; }
    if (run.target !== null) {
      if (filled > run.target) return false;
      if (remaining === 0 && filled !== run.target) return false;
      const need = run.target - filled;
      if (need < remaining || need > remaining * 9) return false;
    }
  }
  return true;
}


function effortModel(inst: KakuroInstance): EffortModel {
  const { runs, cellRuns } = constraints(inst);
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
