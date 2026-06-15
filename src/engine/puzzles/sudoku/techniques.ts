import { UNITS, ROWS, COLS, BOXES, type Candidates } from './candidates';

export type TechniqueName =
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'lockedCandidates'
  | 'nakedPair'
  | 'hiddenPair'
  | 'nakedTriple'
  | 'hiddenTriple'
  | 'xWing';

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

type Elimination = { index: number; digit: number };

/** Empty cells of `unit`, excluding `source`, that still hold candidate `d`. */
function elimsForDigit(unit: number[], source: number[], grid: number[], cand: Candidates, d: number): Elimination[] {
  return unit
    .filter((i) => !source.includes(i) && grid[i] === 0 && cand[i].has(d))
    .map((i) => ({ index: i, digit: d }));
}

/** Sorted candidate signature, so two cells with the same pair compare equal. */
function candKey(set: Set<number>): string {
  return [...set].sort((x, y) => x - y).join();
}

const lockedStep = (eliminations: Elimination[]): Step => ({ technique: 'lockedCandidates', placements: [], eliminations });

/** Pointing: a digit confined to one row/col within a box clears the rest of that line. */
function pointing(grid: number[], cand: Candidates): Step | null {
  for (const box of BOXES) {
    for (let d = 1; d <= 9; d++) {
      if (box.some((i) => grid[i] === d)) continue;
      const spots = box.filter((i) => grid[i] === 0 && cand[i].has(d));
      if (spots.length < 2) continue;
      const rows = new Set(spots.map((i) => Math.floor(i / 9)));
      const cols = new Set(spots.map((i) => i % 9));
      const line = rows.size === 1 ? ROWS[[...rows][0]] : cols.size === 1 ? COLS[[...cols][0]] : null;
      if (!line) continue;
      const elim = elimsForDigit(line, box, grid, cand, d);
      if (elim.length) return lockedStep(elim);
    }
  }
  return null;
}

/** Claiming: a digit confined to one box within a line clears the rest of that box. */
function claiming(grid: number[], cand: Candidates): Step | null {
  for (const line of [...ROWS, ...COLS]) {
    for (let d = 1; d <= 9; d++) {
      if (line.some((i) => grid[i] === d)) continue;
      const spots = line.filter((i) => grid[i] === 0 && cand[i].has(d));
      if (spots.length < 2) continue;
      const boxes = new Set(spots.map(boxIndexOf));
      if (boxes.size !== 1) continue;
      const elim = elimsForDigit(BOXES[[...boxes][0]], line, grid, cand, d);
      if (elim.length) return lockedStep(elim);
    }
  }
  return null;
}

/** Pointing (box→line) and claiming (line→box) eliminations. */
export function lockedCandidates(grid: number[], cand: Candidates): Step | null {
  return pointing(grid, cand) ?? claiming(grid, cand);
}

/** Two cells in a unit sharing the same two candidates → eliminate those digits elsewhere in the unit. */
export function nakedPair(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    const empties = unit.filter((i) => grid[i] === 0 && cand[i].size === 2);
    for (let a = 0; a < empties.length; a++) {
      for (let b = a + 1; b < empties.length; b++) {
        const ia = empties[a];
        const ib = empties[b];
        if (candKey(cand[ia]) !== candKey(cand[ib])) continue;
        const digits = [...cand[ia]];
        const elim = unit.flatMap((i) =>
          i === ia || i === ib || grid[i] !== 0
            ? []
            : digits.filter((d) => cand[i].has(d)).map((d) => ({ index: i, digit: d }))
        );
        if (elim.length) return { technique: 'nakedPair', placements: [], eliminations: elim };
      }
    }
  }
  return null;
}

/** Two digits whose only homes in a unit are the same two cells → clear other candidates from those cells. */
// fallow-ignore-next-line complexity
export function hiddenPair(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    const spots = new Map<number, number[]>();
    for (let d = 1; d <= 9; d++) {
      if (unit.some((i) => grid[i] === d)) continue;
      const cells = unit.filter((i) => grid[i] === 0 && cand[i].has(d));
      if (cells.length === 2) spots.set(d, cells);
    }
    const digits = [...spots.keys()];
    for (let a = 0; a < digits.length; a++) {
      for (let b = a + 1; b < digits.length; b++) {
        const d1 = digits[a];
        const d2 = digits[b];
        const c1 = spots.get(d1)!;
        const c2 = spots.get(d2)!;
        if (c1[0] !== c2[0] || c1[1] !== c2[1]) continue;
        const elim: Elimination[] = [];
        for (const i of c1) for (const d of cand[i]) if (d !== d1 && d !== d2) elim.push({ index: i, digit: d });
        if (elim.length) return { technique: 'hiddenPair', placements: [], eliminations: elim };
      }
    }
  }
  return null;
}
