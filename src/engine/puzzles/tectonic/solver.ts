import { regionSizes, cellsByRegion, kingNeighbors } from './rules';
import type { TectonicInstance } from './types';
import type { SolveResult } from '../../core/types';
import type { PRNG } from '../../core/prng';

interface Ctx {
  width: number;
  height: number;
  sizeOf: number[];
  kings: number[][];
}

function buildCtx(inst: TectonicInstance): Ctx {
  const sizes = regionSizes(inst);
  const sizeOf = inst.regions.map((r) => sizes[r]);
  const kings = inst.regions.map((_, i) => kingNeighbors(i, inst.width, inst.height));
  return { width: inst.width, height: inst.height, sizeOf, kings };
}

function regionPeers(inst: TectonicInstance): number[][] {
  const byRegion = cellsByRegion(inst.regions);
  return inst.regions.map((r, i) => byRegion[r].filter((j) => j !== i));
}

function ok(grid: number[], i: number, v: number, ctx: Ctx, regPeers: number[][]): boolean {
  if (v < 1 || v > ctx.sizeOf[i]) return false;
  for (const p of regPeers[i]) if (grid[p] === v) return false;
  for (const k of ctx.kings[i]) if (grid[k] === v) return false;
  return true;
}

function search(inst: TectonicInstance, limit: number, prng: PRNG | null): number[][] {
  const ctx = buildCtx(inst);
  const regPeers = regionPeers(inst);
  const grid = [...inst.givens];
  const order = grid.map((_, i) => i).filter((i) => grid[i] === 0);
  const solutions: number[][] = [];

  const rec = (k: number): void => {
    if (solutions.length >= limit) return;
    if (k === order.length) { solutions.push([...grid]); return; }
    const i = order[k];
    let values: number[] = [];
    for (let v = 1; v <= ctx.sizeOf[i]; v++) values.push(v);
    if (prng) values = prng.shuffle(values);
    for (const v of values) {
      if (solutions.length >= limit) return;
      if (ok(grid, i, v, ctx, regPeers)) {
        grid[i] = v;
        rec(k + 1);
        grid[i] = 0;
      }
    }
  };
  rec(0);
  return solutions;
}

export function solveComplete(inst: TectonicInstance, limit = 2): SolveResult<number[]> {
  const sols = search(inst, limit, null);
  return { count: sols.length, solution: sols.length ? sols[0] : null };
}

/** A complete valid solution, seeded for reproducibility; null if unsatisfiable. */
export function fill(inst: TectonicInstance, prng: PRNG): number[] | null {
  const sols = search({ ...inst, givens: new Array(inst.regions.length).fill(0) }, 1, prng);
  return sols.length ? sols[0] : null;
}
