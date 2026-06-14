/** Sudoku unit/peer topology + candidate computation. Pure, no randomness. */

function buildUnits(): number[][] {
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) units.push([...Array(9)].map((_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) units.push([...Array(9)].map((_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3;
    const bc = (b % 3) * 3;
    const cells: number[] = [];
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) cells.push((br + dr) * 9 + (bc + dc));
    units.push(cells);
  }
  return units;
}

export const UNITS: number[][] = buildUnits();
export const ROWS: number[][] = UNITS.slice(0, 9);
export const COLS: number[][] = UNITS.slice(9, 18);
export const BOXES: number[][] = UNITS.slice(18, 27);

export const PEERS: number[][] = [...Array(81)].map((_, i) => {
  const set = new Set<number>();
  for (const u of UNITS) {
    if (u.includes(i)) for (const j of u) if (j !== i) set.add(j);
  }
  return [...set];
});

export type Candidates = Set<number>[];

/** For each cell: a singleton if filled, else the digits not used by any filled peer. */
export function computeCandidates(grid: number[]): Candidates {
  return grid.map((v, i) => {
    if (v !== 0) return new Set<number>([v]);
    const used = new Set<number>();
    for (const p of PEERS[i]) if (grid[p] !== 0) used.add(grid[p]);
    const s = new Set<number>();
    for (let d = 1; d <= 9; d++) if (!used.has(d)) s.add(d);
    return s;
  });
}
