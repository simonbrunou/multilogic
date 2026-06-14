import { horizontalRuns, verticalRuns, runPermits, type RunConstraint } from './rules';
import type { KakuroInstance } from './types';
import type { SolveResult } from '../../core/types';
import type { PRNG } from '../../core/prng';

function constraints(inst: KakuroInstance, useClues: boolean): { runs: RunConstraint[]; cellRuns: number[][] } {
  const runs: RunConstraint[] = [];
  const cellRuns: number[][] = inst.black.map(() => []);
  const add = (cells: number[], clueIndex: number, sum: number | undefined) => {
    if (cells.length === 0) return;
    const idx = runs.length;
    runs.push({ cells, target: useClues && clueIndex >= 0 ? (sum ?? null) : null });
    for (const c of cells) cellRuns[c].push(idx);
  };
  for (const run of horizontalRuns(inst.width, inst.height, inst.black)) {
    add(run.cells, run.clueIndex, run.clueIndex >= 0 ? inst.clues[run.clueIndex]?.right : undefined);
  }
  for (const run of verticalRuns(inst.width, inst.height, inst.black)) {
    add(run.cells, run.clueIndex, run.clueIndex >= 0 ? inst.clues[run.clueIndex]?.down : undefined);
  }
  return { runs, cellRuns };
}

function ok(grid: number[], i: number, v: number, runs: RunConstraint[], cellRuns: number[][]): boolean {
  for (const ri of cellRuns[i]) if (!runPermits(runs[ri], grid, i, v)) return false;
  return true;
}

function search(inst: KakuroInstance, limit: number, prng: PRNG | null, useClues: boolean): number[][] {
  const { runs, cellRuns } = constraints(inst, useClues);
  const grid = inst.black.map(() => 0);
  const whites = inst.black.map((b, i) => (b ? -1 : i)).filter((i) => i >= 0);
  const sols: number[][] = [];
  const rec = (k: number): void => {
    if (sols.length >= limit) return;
    if (k === whites.length) { sols.push([...grid]); return; }
    const i = whites[k];
    let values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (prng) values = prng.shuffle(values);
    for (const v of values) {
      if (sols.length >= limit) return;
      if (ok(grid, i, v, runs, cellRuns)) { grid[i] = v; rec(k + 1); grid[i] = 0; }
    }
  };
  rec(0);
  return sols;
}

export function solveComplete(inst: KakuroInstance, limit = 2): SolveResult<number[]> {
  const sols = search(inst, limit, null, true);
  return { count: sols.length, solution: sols.length ? sols[0] : null };
}

/** A valid distinct-respecting filling (no sum constraint), seeded; clues derived afterward. */
export function fill(inst: KakuroInstance, prng: PRNG): number[] | null {
  const sols = search(inst, 1, prng, false);
  return sols.length ? sols[0] : null;
}
