import type { TectonicInstance } from './types';

export function regionSizes(inst: TectonicInstance): Record<number, number> {
  const out: Record<number, number> = {};
  for (const r of inst.regions) out[r] = (out[r] ?? 0) + 1;
  return out;
}

export function cellsByRegion(regions: number[]): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  regions.forEach((r, i) => { (out[r] ??= []).push(i); });
  return out;
}

/** 8-neighbourhood (king move) cell indices within a width×height grid. */
export function kingNeighbors(index: number, width: number, height: number): number[] {
  const r = Math.floor(index / width);
  const c = index % width;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < height && nc >= 0 && nc < width) out.push(nr * width + nc);
    }
  }
  return out;
}

/**
 * Digits 1..regionSize that may still go in empty cell `i`: those not used by a
 * same-region peer or a king-move neighbour. `sizes`/`byRegion` are passed in so
 * callers compute them once per grid. This is the single source of the Tectonic
 * placement rule, shared by the solver/rater and the hint engine.
 */
export function cellCandidates(
  inst: TectonicInstance,
  grid: number[],
  i: number,
  sizes: Record<number, number>,
  byRegion: Record<number, number[]>
): number[] {
  const size = sizes[inst.regions[i]];
  const banned = new Set<number>();
  for (const p of byRegion[inst.regions[i]]) if (grid[p] !== 0) banned.add(grid[p]);
  for (const k of kingNeighbors(i, inst.width, inst.height)) if (grid[k] !== 0) banned.add(grid[k]);
  const out: number[] = [];
  for (let d = 1; d <= size; d++) if (!banned.has(d)) out.push(d);
  return out;
}

export function serializeInstance(inst: TectonicInstance): string {
  return JSON.stringify(inst);
}
export function deserializeInstance(s: string): TectonicInstance {
  return JSON.parse(s) as TectonicInstance;
}
export function serializeSolution(sol: number[]): string {
  return sol.join(',');
}
export function deserializeSolution(s: string): number[] {
  return s.split(',').map(Number);
}
