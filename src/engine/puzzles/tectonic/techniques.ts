import { regionSizes, cellsByRegion, kingNeighbors, cellCandidates } from './rules';
import type { TectonicInstance } from './types';

export interface TectonicCtx {
  inst: TectonicInstance;
  grid: number[];
  cand: Set<number>[];
  regionOf: number[];
  regionCells: Record<number, number[]>;
  kings: number[][];
}

/** Build a mutable solving context: grid copy + per-cell candidate sets + region/king topology. */
export function makeCtx(inst: TectonicInstance): TectonicCtx {
  const sizes = regionSizes(inst);
  const regionCells = cellsByRegion(inst.regions);
  const grid = [...inst.givens];
  const kings = inst.regions.map((_, i) => kingNeighbors(i, inst.width, inst.height));
  const cand = grid.map((v, i) =>
    v !== 0 ? new Set<number>([v]) : new Set<number>(cellCandidates(inst, grid, i, sizes, regionCells))
  );
  return { inst, grid, cand, regionOf: inst.regions, regionCells, kings };
}

/** Place digit `d` in cell `i`, pruning it from region peers and king neighbours. */
function place(ctx: TectonicCtx, i: number, d: number): void {
  ctx.grid[i] = d;
  ctx.cand[i] = new Set<number>([d]);
  for (const p of ctx.regionCells[ctx.regionOf[i]]) if (p !== i) ctx.cand[p].delete(d);
  for (const k of ctx.kings[i]) ctx.cand[k].delete(d);
}

/** Sorted candidate signature, so two cells with the same pair compare equal. */
function candKey(set: Set<number>): string {
  return [...set].sort((a, b) => a - b).join();
}

/** Cells king-adjacent to EVERY cell in `spots` (intersection of their king-neighbour sets). */
function commonKingNeighbors(ctx: TectonicCtx, spots: number[]): number[] {
  let common = new Set<number>(ctx.kings[spots[0]]);
  for (let s = 1; s < spots.length; s++) {
    const ks = new Set<number>(ctx.kings[spots[s]]);
    common = new Set<number>([...common].filter((x) => ks.has(x)));
  }
  return [...common];
}

/** Rank 1: a cell with exactly one candidate. */
export function nakedSingle(ctx: TectonicCtx): boolean {
  for (let i = 0; i < ctx.grid.length; i++) {
    if (ctx.grid[i] === 0 && ctx.cand[i].size === 1) {
      place(ctx, i, [...ctx.cand[i]][0]);
      return true;
    }
  }
  return false;
}

/** Rank 2: a digit that fits in exactly one empty cell of a region. */
export function hiddenSingleRegion(ctx: TectonicCtx): boolean {
  for (const cells of Object.values(ctx.regionCells)) {
    for (let d = 1; d <= cells.length; d++) {
      if (cells.some((i) => ctx.grid[i] === d)) continue;
      const spots = cells.filter((i) => ctx.grid[i] === 0 && ctx.cand[i].has(d));
      if (spots.length === 1) {
        place(ctx, spots[0], d);
        return true;
      }
    }
  }
  return false;
}

/** Remove `digits` from all region cells except the two pair members. Returns true if any candidate was deleted. */
function applyPairToRegion(ctx: TectonicCtx, cells: number[], a: number, b: number, digits: number[]): boolean {
  let changed = false;
  for (const i of cells) {
    if (i === a || i === b || ctx.grid[i] !== 0) continue;
    for (const d of digits) if (ctx.cand[i].delete(d)) changed = true;
  }
  return changed;
}

/** Rank 3: two cells in a region sharing the same two candidates → clear those digits from the region's other cells. */
export function nakedPairRegion(ctx: TectonicCtx): boolean {
  for (const cells of Object.values(ctx.regionCells)) {
    const pairCells = cells.filter((i) => ctx.grid[i] === 0 && ctx.cand[i].size === 2);
    for (let a = 0; a < pairCells.length; a++) {
      for (let b = a + 1; b < pairCells.length; b++) {
        if (candKey(ctx.cand[pairCells[a]]) !== candKey(ctx.cand[pairCells[b]])) continue;
        const digits = [...ctx.cand[pairCells[a]]];
        if (applyPairToRegion(ctx, cells, pairCells[a], pairCells[b], digits)) return true;
      }
    }
  }
  return false;
}

/** Rank 4: if a digit's region-candidate cells are all king-adjacent to a cell X, X can't be that digit. */
export function kingPointing(ctx: TectonicCtx): boolean {
  for (const cells of Object.values(ctx.regionCells)) {
    for (let d = 1; d <= cells.length; d++) {
      if (cells.some((i) => ctx.grid[i] === d)) continue;
      const spots = cells.filter((i) => ctx.grid[i] === 0 && ctx.cand[i].has(d));
      if (spots.length < 2) continue;
      let changed = false;
      for (const x of commonKingNeighbors(ctx, spots)) {
        if (ctx.grid[x] === 0 && !spots.includes(x) && ctx.cand[x].delete(d)) changed = true;
      }
      if (changed) return true;
    }
  }
  return false;
}
