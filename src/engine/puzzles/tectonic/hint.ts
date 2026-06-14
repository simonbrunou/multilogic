import { regionSizes, cellsByRegion, kingNeighbors } from './rules';
import type { TectonicInstance, TectonicState } from './types';
import type { Hint } from '../../core/types';

export function getHint(inst: TectonicInstance, state: TectonicState): Hint | null {
  const grid = inst.givens.map((g, i) => (g !== 0 ? g : state.cells[i] || 0));
  const sizes = regionSizes(inst);
  const byRegion = cellsByRegion(inst.regions);
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== 0) continue;
    const size = sizes[inst.regions[i]];
    const banned = new Set<number>();
    for (const p of byRegion[inst.regions[i]]) if (grid[p] !== 0) banned.add(grid[p]);
    for (const k of kingNeighbors(i, inst.width, inst.height)) if (grid[k] !== 0) banned.add(grid[k]);
    const cands: number[] = [];
    for (let d = 1; d <= size; d++) if (!banned.has(d)) cands.push(d);
    if (cands.length === 1) return { cells: [i], text: `Naked single: place ${cands[0]}` };
  }
  return null;
}
