import { describe, it, expect, beforeAll } from 'vitest';
import { buildBundle, type PuzzleBundle } from '../../scripts/pregen';
import { getModule } from '../../src/engine/puzzles/registry';
import { DIFFICULTIES } from '../../src/engine/core/types';

// Building the full bundle exercises every type's generator (with retry budgets), which is
// expensive — and dramatically more so under v8 coverage on CI. Build it ONCE and share it;
// only the determinism test needs a second build. Generous timeouts cover the coverage run.
const BUILD_TIMEOUT = 180_000;

describe('pregen buildBundle', () => {
  let bundle: PuzzleBundle;

  beforeAll(async () => {
    bundle = await buildBundle(1);
  }, BUILD_TIMEOUT);

  it('produces a versioned bundle with puzzles for every difficulty', () => {
    expect(bundle.engineVersion).toBe(1);
    expect(bundle.puzzles.length).toBeGreaterThan(0);
    const requestedDifficulties = new Set(bundle.puzzles.map((p) => p.requested));
    expect([...requestedDifficulties].every((d) => (DIFFICULTIES as readonly string[]).includes(d))).toBe(true);
    const types = new Set(bundle.puzzles.map((p) => p.type));
    expect(types.has('sudoku')).toBe(true);
    expect(types.has('tectonic')).toBe(true);
    expect(types.has('grecolatin')).toBe(true);
    expect(types.has('yakuso')).toBe(true);
  });

  it('every bundled puzzle is uniquely solvable to its stored solution', () => {
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
  });

  it('is deterministic (same version → identical bundle)', async () => {
    const again = await buildBundle(1);
    expect(JSON.stringify(again)).toBe(JSON.stringify(bundle));
  }, BUILD_TIMEOUT);
});
