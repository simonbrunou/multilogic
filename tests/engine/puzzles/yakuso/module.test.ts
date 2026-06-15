import { describe, it, expect } from 'vitest';
import { yakuso } from '../../../../src/engine/puzzles/yakuso/index';
import { getModule } from '../../../../src/engine/puzzles/registry';
import { createPrng } from '../../../../src/engine/core/prng';

function sig(): AbortSignal { return new AbortController().signal; }

describe('yakuso module', () => {
  it('is a registered deduction puzzle with the serialization seam', () => {
    expect(yakuso.type).toBe('yakuso');
    expect(yakuso.kind).toBe('deduction');
    expect(getModule('yakuso').type).toBe('yakuso');
  });

  it('generates a unique puzzle and round-trips serialization', async () => {
    const res = await yakuso.generate({ difficulty: 'easy', prng: createPrng('ym1'), signal: sig() });
    expect(yakuso.solveComplete(res.instance, 2).count).toBe(1);
    expect(yakuso.deserializeInstance(yakuso.serializeInstance(res.instance))).toEqual(res.instance);
    expect(res.solution).not.toBeNull();
  });

  it('validateMove rejects givens, out-of-range index and out-of-range values', async () => {
    const res = await yakuso.generate({ difficulty: 'easy', prng: createPrng('ym2'), signal: sig() });
    const givenIdx = res.instance.clues.findIndex((c) => c !== null);
    const freeIdx = res.instance.clues.findIndex((c) => c === null);
    const state = { cells: res.instance.clues.map((c) => c ?? 0) };
    expect(yakuso.validateMove(res.instance, state, { index: givenIdx, value: 1 }).ok).toBe(false);
    expect(yakuso.validateMove(res.instance, state, { index: -1, value: 1 }).ok).toBe(false);
    expect(yakuso.validateMove(res.instance, state, { index: freeIdx, value: res.instance.rows + 1 }).ok).toBe(false);
    expect(yakuso.validateMove(res.instance, state, { index: freeIdx, value: 0 }).ok).toBe(true);
    expect(yakuso.validateMove(res.instance, state, { index: freeIdx, value: res.instance.rows }).ok).toBe(true);
  });

  it('render exposes the totals row and current cells', async () => {
    const res = await yakuso.generate({ difficulty: 'easy', prng: createPrng('ym3'), signal: sig() });
    const r = yakuso.render(res.instance, { cells: res.instance.clues.map((c) => c ?? 0) });
    expect(r.kind).toBe('yakuso');
    expect(r.totals).toEqual(res.instance.totals);
  });
});
