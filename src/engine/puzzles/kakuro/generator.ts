import { fill, solveComplete } from './solver';
import { deriveClues, horizontalRuns, verticalRuns } from './rules';
import { rate } from './rater';
import type { KakuroInstance } from './types';
import type { PRNG } from '../../core/prng';
import type { Difficulty } from '../../core/types';

export interface GeneratedKakuro { instance: KakuroInstance; solution: number[]; difficulty: Difficulty }

/**
 * Black border (row 0 & col 0) + sparse interior walls.
 * After random placement, iteratively convert any length-1 run cells to black
 * until stable, eliminating isolated white cells that would make the puzzle invalid.
 * Returns null if any run is >9 cells or no white cells remain.
 */
function buildTopology(width: number, height: number, prng: PRNG, p: number): boolean[] | null {
  const black = new Array<boolean>(width * height).fill(false);
  for (let c = 0; c < width; c++) black[c] = true;
  for (let r = 0; r < height; r++) black[r * width] = true;
  for (let r = 1; r < height; r++) for (let c = 1; c < width; c++) if (prng.next() < p) black[r * width + c] = true;

  // Iteratively fix length-1 runs by turning those white cells black
  let changed = true;
  while (changed) {
    changed = false;
    const runs = [...horizontalRuns(width, height, black), ...verticalRuns(width, height, black)];
    for (const run of runs) {
      if (run.cells.length === 1) { black[run.cells[0]] = true; changed = true; }
    }
  }

  const runs = [...horizontalRuns(width, height, black), ...verticalRuns(width, height, black)];
  let whiteCount = 0;
  for (const run of runs) {
    if (run.cells.length > 9) return null;
    whiteCount += run.cells.length;
  }
  if (whiteCount === 0) return null;
  return black;
}

export function generateForDifficulty(prng: PRNG, target: Difficulty, width = 6, height = 6): GeneratedKakuro {
  for (let attempt = 0; attempt < 300; attempt++) {
    const black = buildTopology(width, height, prng, 0.38);
    if (!black) continue;
    const base: KakuroInstance = { width, height, black, clues: black.map((b) => (b ? {} : null)) };
    const sol = fill(base, prng);
    if (!sol) continue;
    const inst: KakuroInstance = { width, height, black, clues: deriveClues(base, sol) };
    if (solveComplete(inst, 2).count !== 1) continue; // require uniqueness
    void target; // difficulty targeting is best-effort; achievedDifficulty reported below
    return { instance: inst, solution: sol, difficulty: rate(inst) };
  }
  throw new Error('kakuro: failed to generate a unique puzzle');
}
