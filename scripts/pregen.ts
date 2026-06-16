import { MODULES } from '../src/engine/puzzles/registry';
import { createPrng, deriveSeed } from '../src/engine/core/prng';
import { DIFFICULTIES, type Difficulty, type PuzzleType } from '../src/engine/core/types';

const PER_DIFFICULTY = 3;
const MAX_SEED_ATTEMPTS = 60;

export interface BundledPuzzle {
  type: PuzzleType;
  requested: Difficulty;
  achieved: Difficulty;
  instance: string;
  solution: string;
}

export interface PuzzleBundle {
  engineVersion: number;
  puzzles: BundledPuzzle[];
}

/** Build the fallback bundle deterministically from the engine version. */
export async function buildBundle(engineVersion: number): Promise<PuzzleBundle> {
  const puzzles: BundledPuzzle[] = [];
  for (const [puzzleType, mod] of Object.entries(MODULES) as [PuzzleType, typeof MODULES[PuzzleType]][]) {
    if (!mod) continue;
    for (const difficulty of DIFFICULTIES) {
      for (let n = 0; n < PER_DIFFICULTY; n++) {
        // Try up to MAX_SEED_ATTEMPTS seed offsets until generation succeeds
        let res: Awaited<ReturnType<typeof mod.generate>> | null = null;
        let seedOffset = 0;
        while (res === null && seedOffset < MAX_SEED_ATTEMPTS) {
          const prng = createPrng(deriveSeed(puzzleType, difficulty, 'pregen', engineVersion, n, seedOffset));
          const signal = new AbortController().signal;
          try {
            res = await mod.generate({ difficulty, prng, signal });
          } catch {
            seedOffset++;
          }
        }
        if (res === null) throw new Error(`Failed to generate ${puzzleType}/${difficulty} after ${MAX_SEED_ATTEMPTS} attempts`);
        puzzles.push({
          type: puzzleType,
          requested: difficulty,
          achieved: res.achievedDifficulty,
          instance: mod.serializeInstance(res.instance),
          solution: res.solution !== null && res.solution !== undefined ? mod.serializeSolution(res.solution) : ''
        });
      }
    }
  }
  return { engineVersion, puzzles };
}

if (import.meta.main) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const ENGINE_VERSION = 2;
  const bundle = await buildBundle(ENGINE_VERSION);
  mkdirSync('static', { recursive: true });
  writeFileSync('static/puzzles.bundle.json', JSON.stringify(bundle));
  console.log(`wrote ${bundle.puzzles.length} puzzles to static/puzzles.bundle.json`);
}
