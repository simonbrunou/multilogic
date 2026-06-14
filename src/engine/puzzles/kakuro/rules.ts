import type { KakuroInstance, KakuroClue } from './types';

export interface Run { cells: number[]; clueIndex: number; dir: 'h' | 'v' }

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
