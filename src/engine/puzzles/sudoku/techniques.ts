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

/** Map each still-unplaced digit of `unit` to the empty cells that can hold it, when that count is in [2, maxCells]. */
function digitHomes(unit: number[], grid: number[], cand: Candidates, maxCells: number): Map<number, number[]> {
  const homes = new Map<number, number[]>();
  for (let d = 1; d <= 9; d++) {
    if (unit.some((i) => grid[i] === d)) continue;
    const cells = unit.filter((i) => grid[i] === 0 && cand[i].has(d));
    if (cells.length >= 2 && cells.length <= maxCells) homes.set(d, cells);
  }
  return homes;
}

/** Eliminations that strip every candidate except those in `keep` from each of `cells`. */
function keepOnly(cells: number[], cand: Candidates, keep: number[]): Elimination[] {
  const elim: Elimination[] = [];
  for (const i of cells) for (const d of cand[i]) if (!keep.includes(d)) elim.push({ index: i, digit: d });
  return elim;
}

/** Two digits whose only homes in a unit are the same two cells → clear other candidates from those cells. */
export function hiddenPair(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    const homes = digitHomes(unit, grid, cand, 2);
    const digits = [...homes.keys()];
    for (let a = 0; a < digits.length; a++) {
      for (let b = a + 1; b < digits.length; b++) {
        const c1 = homes.get(digits[a])!;
        const c2 = homes.get(digits[b])!;
        if (c1[0] !== c2[0] || c1[1] !== c2[1]) continue;
        const elim = keepOnly(c1, cand, [digits[a], digits[b]]);
        if (elim.length) return { technique: 'hiddenPair', placements: [], eliminations: elim };
      }
    }
  }
  return null;
}

/** Eliminations removing any of `digits` from empty cells of `unit` that are not in `keep`. */
function clearDigitsFrom(unit: number[], keep: number[], grid: number[], cand: Candidates, digits: number[]): Elimination[] {
  return unit.flatMap((i) =>
    keep.includes(i) || grid[i] !== 0 ? [] : digits.filter((d) => cand[i].has(d)).map((d) => ({ index: i, digit: d }))
  );
}

/** If three cells' candidates union to exactly three digits, the resulting naked-triple step (else null). */
function nakedTripleStep(unit: number[], trio: number[], grid: number[], cand: Candidates): Step | null {
  const union = new Set<number>([...cand[trio[0]], ...cand[trio[1]], ...cand[trio[2]]]);
  if (union.size !== 3) return null;
  const elim = clearDigitsFrom(unit, trio, grid, cand, [...union]);
  return elim.length ? { technique: 'nakedTriple', placements: [], eliminations: elim } : null;
}

/** Three cells in a unit whose candidates union to exactly three digits → clear those digits elsewhere in the unit. */
export function nakedTriple(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    const empties = unit.filter((i) => grid[i] === 0 && cand[i].size >= 2 && cand[i].size <= 3);
    for (let a = 0; a < empties.length; a++) {
      for (let b = a + 1; b < empties.length; b++) {
        for (let c = b + 1; c < empties.length; c++) {
          const step = nakedTripleStep(unit, [empties[a], empties[b], empties[c]], grid, cand);
          if (step) return step;
        }
      }
    }
  }
  return null;
}

/** If three digits' homes union to exactly three cells, the resulting hidden-triple step (else null). */
function hiddenTripleStep(homes: Map<number, number[]>, trio: number[], cand: Candidates): Step | null {
  const cells = new Set<number>([...homes.get(trio[0])!, ...homes.get(trio[1])!, ...homes.get(trio[2])!]);
  if (cells.size !== 3) return null;
  const elim = keepOnly([...cells], cand, trio);
  return elim.length ? { technique: 'hiddenTriple', placements: [], eliminations: elim } : null;
}

/** Three digits whose only homes in a unit are the same three cells → clear other candidates from those cells. */
export function hiddenTriple(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    const homes = digitHomes(unit, grid, cand, 3);
    const digits = [...homes.keys()];
    for (let a = 0; a < digits.length; a++) {
      for (let b = a + 1; b < digits.length; b++) {
        for (let c = b + 1; c < digits.length; c++) {
          const step = hiddenTripleStep(homes, [digits[a], digits[b], digits[c]], cand);
          if (step) return step;
        }
      }
    }
  }
  return null;
}
