import { sudoku } from '../src/engine/puzzles/sudoku/index';
import { createPrng, deriveSeed } from '../src/engine/core/prng';
import { DIFFICULTIES, type Difficulty } from '../src/engine/core/types';
import { gridToString } from '../src/engine/puzzles/sudoku/rules';

const PER_DIFFICULTY = 1;

export interface BundledPuzzle {
  type: 'sudoku';
  requested: Difficulty;
  achieved: Difficulty;
  givens: string;
  solution: string;
}

export interface PuzzleBundle {
  engineVersion: number;
  puzzles: BundledPuzzle[];
}

/** Build the fallback bundle deterministically from the engine version. */
export async function buildBundle(engineVersion: number): Promise<PuzzleBundle> {
  const puzzles: BundledPuzzle[] = [];
  for (const difficulty of DIFFICULTIES) {
    for (let n = 0; n < PER_DIFFICULTY; n++) {
      const prng = createPrng(deriveSeed('sudoku', difficulty, 'pregen', engineVersion, n));
      const signal = new AbortController().signal;
      const res = await sudoku.generate({ difficulty, prng, signal });
      puzzles.push({
        type: 'sudoku',
        requested: difficulty,
        achieved: res.achievedDifficulty,
        givens: gridToString(res.instance.givens),
        solution: gridToString(res.solution!)
      });
    }
  }
  return { engineVersion, puzzles };
}

if (import.meta.main) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const ENGINE_VERSION = 1;
  const bundle = await buildBundle(ENGINE_VERSION);
  mkdirSync('static', { recursive: true });
  writeFileSync('static/puzzles.bundle.json', JSON.stringify(bundle));
  console.log(`wrote ${bundle.puzzles.length} puzzles to static/puzzles.bundle.json`);
}
