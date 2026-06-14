import { describe, it, expect } from 'vitest';
import { buildBundle, type PuzzleBundle } from '../../scripts/pregen';
import { gridFromString } from '../../src/engine/puzzles/sudoku/rules';
import { solveComplete } from '../../src/engine/puzzles/sudoku/solver';

describe('pregen buildBundle', () => {
  it('produces a versioned bundle with puzzles for every difficulty', async () => {
    const bundle: PuzzleBundle = await buildBundle(1);
    expect(bundle.engineVersion).toBe(1);
    expect(bundle.puzzles.length).toBeGreaterThan(0);
    const difficulties = new Set(bundle.puzzles.map((p) => p.requested));
    expect(difficulties).toEqual(new Set(['easy', 'medium', 'hard', 'expert']));
  }, 60000);

  it('every bundled puzzle is uniquely solvable to its stored solution', async () => {
    const bundle = await buildBundle(1);
    for (const p of bundle.puzzles) {
      const res = solveComplete({ givens: gridFromString(p.givens) }, 2);
      expect(res.count).toBe(1);
    }
  }, 60000);

  it('is deterministic (same version → identical bundle)', async () => {
    const a = await buildBundle(1);
    const b = await buildBundle(1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  }, 60000);
});
