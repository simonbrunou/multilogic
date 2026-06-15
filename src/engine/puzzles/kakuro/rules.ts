import type { KakuroInstance, KakuroClue } from './types';

export interface Run { cells: number[]; clueIndex: number; dir: 'h' | 'v' }

/** A run reduced to the data needed for constraint checks: its cells and target sum (null = no clue). */
export interface RunConstraint { cells: number[]; target: number | null }

/**
 * Whether placing `v` at cell `i` keeps `run` valid: no digit repeats within the
 * run, and — for a clued run — the partial sum stays within reach of the target
 * (`remaining` empty cells must each take 1..9). Shared by the solver, rater, and
 * hint engine so the Kakuro placement rule lives in exactly one place.
 */
export function runPermits(run: RunConstraint, grid: number[], i: number, v: number): boolean {
  let filled = 0;
  let remaining = 0;
  for (const c of run.cells) {
    const val = c === i ? v : grid[c];
    if (val === v && c !== i) return false; // distinctness
    if (val !== 0) filled += val;
    else remaining++;
  }
  if (run.target === null) return true;
  const need = run.target - filled;
  return !(filled > run.target || (remaining === 0 && filled !== run.target) || need < remaining || need > remaining * 9);
}

export function horizontalRuns(width: number, height: number, black: boolean[]): Run[] {
  const runs: Run[] = [];
  for (let r = 0; r < height; r++) {
    let c = 0;
    while (c < width) {
      if (black[r * width + c]) { c++; continue; }
      const start = c;
      const cells: number[] = [];
      while (c < width && !black[r * width + c]) { cells.push(r * width + c); c++; }
      runs.push({ cells, clueIndex: start > 0 ? r * width + (start - 1) : -1, dir: 'h' });
    }
  }
  return runs;
}

export function verticalRuns(width: number, height: number, black: boolean[]): Run[] {
  const runs: Run[] = [];
  for (let c = 0; c < width; c++) {
    let r = 0;
    while (r < height) {
      if (black[r * width + c]) { r++; continue; }
      const start = r;
      const cells: number[] = [];
      while (r < height && !black[r * width + c]) { cells.push(r * width + c); r++; }
      runs.push({ cells, clueIndex: start > 0 ? (start - 1) * width + c : -1, dir: 'v' });
    }
  }
  return runs;
}

/** Build constraint runs and per-cell run index lists from a KakuroInstance. */
export function buildRunConstraints(inst: KakuroInstance): { runs: RunConstraint[]; cellRuns: number[][] } {
  const runs: RunConstraint[] = [];
  const cellRuns: number[][] = inst.black.map(() => []);
  const add = (cells: number[], sum: number | undefined) => {
    if (!cells.length) return;
    const idx = runs.length;
    runs.push({ cells, target: sum ?? null });
    for (const c of cells) cellRuns[c].push(idx);
  };
  for (const r of horizontalRuns(inst.width, inst.height, inst.black)) {
    add(r.cells, r.clueIndex >= 0 ? inst.clues[r.clueIndex]?.right : undefined);
  }
  for (const r of verticalRuns(inst.width, inst.height, inst.black)) {
    add(r.cells, r.clueIndex >= 0 ? inst.clues[r.clueIndex]?.down : undefined);
  }
  return { runs, cellRuns };
}

export function allRuns(inst: KakuroInstance): Run[] {
  return [...horizontalRuns(inst.width, inst.height, inst.black), ...verticalRuns(inst.width, inst.height, inst.black)];
}

/** Derive clue sums from a complete solution (0 on black cells). */
export function deriveClues(inst: KakuroInstance, sol: number[]): (KakuroClue | null)[] {
  const clues: (KakuroClue | null)[] = inst.black.map((b) => (b ? {} : null));
  for (const run of horizontalRuns(inst.width, inst.height, inst.black)) {
    if (run.clueIndex < 0) continue;
    (clues[run.clueIndex] as KakuroClue).right = run.cells.reduce((s, i) => s + sol[i], 0);
  }
  for (const run of verticalRuns(inst.width, inst.height, inst.black)) {
    if (run.clueIndex < 0) continue;
    (clues[run.clueIndex] as KakuroClue).down = run.cells.reduce((s, i) => s + sol[i], 0);
  }
  return clues;
}

export function serializeInstance(inst: KakuroInstance): string { return JSON.stringify(inst); }
export function deserializeInstance(s: string): KakuroInstance { return JSON.parse(s) as KakuroInstance; }
export function serializeSolution(sol: number[]): string { return sol.join(','); }
export function deserializeSolution(s: string): number[] { return s.split(',').map(Number); }
