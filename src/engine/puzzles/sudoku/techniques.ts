import { UNITS, type Candidates } from './candidates';

export type TechniqueName = 'nakedSingle' | 'hiddenSingle' | 'lockedCandidates' | 'nakedPair';

/**
 * A single deduction step. A step EITHER places digits (`placements`) OR removes
 * candidates (`eliminations`); the unused array is empty. Consumers must not assume
 * both are populated.
 */
export interface Step {
  technique: TechniqueName;
  placements: { index: number; digit: number }[];
  eliminations: { index: number; digit: number }[];
}

/** A cell with exactly one remaining candidate. */
export function nakedSingle(grid: number[], cand: Candidates): Step | null {
  for (let i = 0; i < 81; i++) {
    if (grid[i] === 0 && cand[i].size === 1) {
      const digit = [...cand[i]][0];
      return { technique: 'nakedSingle', placements: [{ index: i, digit }], eliminations: [] };
    }
  }
  return null;
}

/** A digit that can go in exactly one empty cell of some unit. */
export function hiddenSingle(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      if (unit.some((i) => grid[i] === d)) continue;
      const spots = unit.filter((i) => grid[i] === 0 && cand[i].has(d));
      if (spots.length === 1) {
        return { technique: 'hiddenSingle', placements: [{ index: spots[0], digit: d }], eliminations: [] };
      }
    }
  }
  return null;
}
