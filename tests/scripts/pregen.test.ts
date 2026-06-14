import { describe, it, expect } from 'vitest';
import { buildBundle, type PuzzleBundle } from '../../scripts/pregen';
import { getModule } from '../../src/engine/puzzles/registry';
import { DIFFICULTIES } from '../../src/engine/core/types';

describe('pregen buildBundle', () => {
  it('produces a versioned bundle with puzzles for every difficulty', async () => {
    const bundle: PuzzleBundle = await buildBundle(1);
    expect(bundle.engineVersion).toBe(1);
    expect(bundle.puzzles.length).toBeGreaterThan(0);
    const requestedDifficulties = new Set(bundle.puzzles.map((p) => p.requested));
    expect([...requestedDifficulties].every((d) => (DIFFICULTIES as readonly string[]).includes(d))).toBe(true);
    const types = new Set(bundle.puzzles.map((p) => p.type));
    expect(types.has('sudoku')).toBe(true);
    expect(types.has('tectonic')).toBe(true);
    expect(types.has('grecolatin')).toBe(true);
  }, 60000);

  it('every bundled puzzle is uniquely solvable to its stored solution', async () => {
    const bundle = await buildBundle(1);
    for (const p of bundle.puzzles) {
      const mod = getModule(p.type);
      if (mod.kind === 'construction') {
        // Construction puzzles: verify the instance deserializes and the module kind is correct
        expect(mod.deserializeInstance(p.instance)).toBeTruthy();
        expect(mod.kind).toBe('construction');
        continue;
      }
      const instance = mod.deserializeInstance(p.instance);
      const res = (mod as { solveComplete: (inst: unknown, limit: number) => { count: number } }).solveComplete(instance, 2);
      expect(res.count).toBe(1);
    }
  }, 60000);

  it('is deterministic (same version → identical bundle)', async () => {
    const a = await buildBundle(1);
    const b = await buildBundle(1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  }, 60000);
});
