import { UNITS, ROWS, COLS, BOXES, type Candidates } from './candidates';

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

function boxIndexOf(i: number): number {
  const r = Math.floor(i / 9);
  const c = i % 9;
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

/** Pointing (box→line) and claiming (line→box) eliminations. */
export function lockedCandidates(grid: number[], cand: Candidates): Step | null {
  for (const box of BOXES) {
    for (let d = 1; d <= 9; d++) {
      if (box.some((i) => grid[i] === d)) continue;
      const spots = box.filter((i) => grid[i] === 0 && cand[i].has(d));
      if (spots.length < 2) continue;
      const rows = new Set(spots.map((i) => Math.floor(i / 9)));
      const cols = new Set(spots.map((i) => i % 9));
      if (rows.size === 1) {
        const r = [...rows][0];
        const elim = ROWS[r]
          .filter((i) => !box.includes(i) && grid[i] === 0 && cand[i].has(d))
          .map((i) => ({ index: i, digit: d }));
        if (elim.length) return { technique: 'lockedCandidates', placements: [], eliminations: elim };
      }
      if (cols.size === 1) {
        const c = [...cols][0];
        const elim = COLS[c]
          .filter((i) => !box.includes(i) && grid[i] === 0 && cand[i].has(d))
          .map((i) => ({ index: i, digit: d }));
        if (elim.length) return { technique: 'lockedCandidates', placements: [], eliminations: elim };
      }
    }
  }
  for (const line of [...ROWS, ...COLS]) {
    for (let d = 1; d <= 9; d++) {
      if (line.some((i) => grid[i] === d)) continue;
      const spots = line.filter((i) => grid[i] === 0 && cand[i].has(d));
      if (spots.length < 2) continue;
      const boxes = new Set(spots.map(boxIndexOf));
      if (boxes.size === 1) {
        const b = [...boxes][0];
        const elim = BOXES[b]
          .filter((i) => !line.includes(i) && grid[i] === 0 && cand[i].has(d))
          .map((i) => ({ index: i, digit: d }));
        if (elim.length) return { technique: 'lockedCandidates', placements: [], eliminations: elim };
      }
    }
  }
  return null;
}

/** Two cells in a unit sharing the same two candidates → eliminate those digits elsewhere in the unit. */
export function nakedPair(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    const empties = unit.filter((i) => grid[i] === 0 && cand[i].size === 2);
    for (let a = 0; a < empties.length; a++) {
      for (let b = a + 1; b < empties.length; b++) {
        const ia = empties[a];
        const ib = empties[b];
        const sa = [...cand[ia]].sort((x, y) => x - y).join();
        const sb = [...cand[ib]].sort((x, y) => x - y).join();
        if (sa !== sb) continue;
        const digits = [...cand[ia]];
        const elim: { index: number; digit: number }[] = [];
        for (const i of unit) {
          if (i === ia || i === ib || grid[i] !== 0) continue;
          for (const d of digits) if (cand[i].has(d)) elim.push({ index: i, digit: d });
        }
        if (elim.length) return { technique: 'nakedPair', placements: [], eliminations: elim };
      }
    }
  }
  return null;
}
