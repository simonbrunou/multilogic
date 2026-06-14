import { describe, it, expect } from 'vitest';
import { tectonic } from '../../../../src/engine/puzzles/tectonic/index';
import { createPrng } from '../../../../src/engine/core/prng';

function sig(): AbortSignal { return new AbortController().signal; }

describe('tectonic module', () => {
  it('is a deduction puzzle with the seam methods', () => {
    expect(tectonic.type).toBe('tectonic');
    expect(tectonic.kind).toBe('deduction');
    expect(typeof tectonic.serializeInstance).toBe('function');
  });
  it('generates a uniquely-solvable puzzle whose givens subset of solution', async () => {
    const res = await tectonic.generate({ difficulty: 'easy', prng: createPrng('g1'), signal: sig() });
    expect(tectonic.solveComplete(res.instance, 2).count).toBe(1);
    for (let i = 0; i < res.solution!.length; i++) {
      if (res.instance.givens[i] !== 0) expect(res.instance.givens[i]).toBe(res.solution![i]);
    }
  });
  it('serialize/deserialize round-trips an instance', async () => {
    const res = await tectonic.generate({ difficulty: 'easy', prng: createPrng('g2'), signal: sig() });
    const s = tectonic.serializeInstance(res.instance);
    expect(tectonic.deserializeInstance(s)).toEqual(res.instance);
  });
  it('generate is deterministic for a seed', async () => {
    const a = await tectonic.generate({ difficulty: 'easy', prng: createPrng('gx'), signal: sig() });
    const b = await tectonic.generate({ difficulty: 'easy', prng: createPrng('gx'), signal: sig() });
    expect(tectonic.serializeInstance(a.instance)).toBe(tectonic.serializeInstance(b.instance));
  });
  it('validateMove rejects givens and out-of-region-range values', () => {
    const inst = { width: 2, height: 1, regions: [0, 0], givens: [1, 0] };
    const state = { cells: [0, 0] };
    expect(tectonic.validateMove(inst, state, { index: 0, value: 2 }).ok).toBe(false);
    expect(tectonic.validateMove(inst, state, { index: 1, value: 5 }).ok).toBe(false);
    expect(tectonic.validateMove(inst, state, { index: 1, value: 2 }).ok).toBe(true);
  });
});
