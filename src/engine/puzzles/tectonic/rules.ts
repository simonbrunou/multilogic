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
