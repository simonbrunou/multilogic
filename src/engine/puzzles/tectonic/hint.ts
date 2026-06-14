import { regionSizes, cellsByRegion, cellCandidates } from './rules';
import type { TectonicInstance, TectonicState } from './types';
import type { Hint } from '../../core/types';

export function getHint(inst: TectonicInstance, state: TectonicState): Hint | null {
  const grid = inst.givens.map((g, i) => (g !== 0 ? g : state.cells[i] || 0));
  const sizes = regionSizes(inst);
  const byRegion = cellsByRegion(inst.regions);
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== 0) continue;
    const cands = cellCandidates(inst, grid, i, sizes, byRegion);
    if (cands.length === 1) return { cells: [i], text: `Naked single: place ${cands[0]}` };
  }
  return null;
}
