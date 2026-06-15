import { buildRunConstraints, runPermits, type RunConstraint } from './rules';
import type { KakuroInstance, KakuroState } from './types';
import type { Hint } from '../../core/types';


/** A value is a candidate at `i` only if every run through `i` permits it. */
function isCandidate(grid: number[], i: number, v: number, runs: RunConstraint[], cellRuns: number[][]): boolean {
  for (const ri of cellRuns[i]) if (!runPermits(runs[ri], grid, i, v)) return false;
  return true;
}

export function getHint(inst: KakuroInstance, state: KakuroState): Hint | null {
  const grid = inst.black.map((b, i) => (b ? 0 : state.cells[i] || 0));
  const { runs, cellRuns } = buildRunConstraints(inst);
  for (let i = 0; i < grid.length; i++) {
    if (inst.black[i] || grid[i] !== 0) continue;
    const cands: number[] = [];
    for (let v = 1; v <= 9; v++) if (isCandidate(grid, i, v, runs, cellRuns)) cands.push(v);
    if (cands.length === 1) return { cells: [i], text: `Forced: place ${cands[0]}` };
  }
  return null;
}
