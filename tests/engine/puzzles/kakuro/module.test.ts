import { describe, it, expect } from 'vitest';
import { kakuro } from '../../../../src/engine/puzzles/kakuro/index';
import { getModule } from '../../../../src/engine/puzzles/registry';
import { createPrng } from '../../../../src/engine/core/prng';

function sig(): AbortSignal { return new AbortController().signal; }

describe('kakuro module', () => {
  it('is a registered deduction puzzle with the seam', () => {
    expect(kakuro.type).toBe('kakuro');
    expect(kakuro.kind).toBe('deduction');
    expect(getModule('kakuro').type).toBe('kakuro');
  });
  it('generates a unique puzzle and round-trips serialization', async () => {
    const res = await kakuro.generate({ difficulty: 'easy', prng: createPrng('km1'), signal: sig() });
    expect(kakuro.solveComplete(res.instance, 2).count).toBe(1);
    expect(kakuro.deserializeInstance(kakuro.serializeInstance(res.instance))).toEqual(res.instance);
  });
  it('validateMove rejects black cells and out-of-range values', async () => {
    const res = await kakuro.generate({ difficulty: 'easy', prng: createPrng('km2'), signal: sig() });
    const blackIdx = res.instance.black.findIndex((b) => b);
    const whiteIdx = res.instance.black.findIndex((b) => !b);
    const state = { cells: res.instance.black.map(() => 0) };
    expect(kakuro.validateMove(res.instance, state, { index: blackIdx, value: 1 }).ok).toBe(false);
    expect(kakuro.validateMove(res.instance, state, { index: whiteIdx, value: 10 }).ok).toBe(false);
    expect(kakuro.validateMove(res.instance, state, { index: whiteIdx, value: 5 }).ok).toBe(true);
  });
});
