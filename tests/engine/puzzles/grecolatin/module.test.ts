import { describe, it, expect } from 'vitest';
import { grecolatin } from '../../../../src/engine/puzzles/grecolatin/index';
import { getModule } from '../../../../src/engine/puzzles/registry';
import { validateGrid } from '../../../../src/engine/puzzles/grecolatin/rules';
import { createPrng } from '../../../../src/engine/core/prng';

function sig(): AbortSignal { return new AbortController().signal; }

describe('grecolatin module', () => {
  it('is a registered construction puzzle with the seam', () => {
    expect(grecolatin.type).toBe('grecolatin');
    expect(grecolatin.kind).toBe('construction');
    expect(getModule('grecolatin').type).toBe('grecolatin');
    expect(typeof grecolatin.serializeInstance).toBe('function');
  });
  it('generate yields conflict-free givens and round-trips serialization', async () => {
    const res = await grecolatin.generate({ difficulty: 'easy', prng: createPrng('m1'), signal: sig() });
    expect(validateGrid(res.instance.n, res.instance.givens).valid).toBe(true);
    expect(grecolatin.deserializeInstance(grecolatin.serializeInstance(res.instance))).toEqual(res.instance);
    expect(res.solution).toBeNull();
  });
  it('validate scores a partial vs complete grid', async () => {
    const res = await grecolatin.generate({ difficulty: 'easy', prng: createPrng('m2'), signal: sig() });
    const partial = grecolatin.validate(res.instance, { cells: res.instance.givens });
    expect(partial.complete).toBe(false);
    expect(partial.valid).toBe(true);
    expect(partial.score).toBeGreaterThan(0);
  });
  it('validateMove rejects given cells and out-of-range pair codes', async () => {
    const res = await grecolatin.generate({ difficulty: 'easy', prng: createPrng('m3'), signal: sig() });
    const n = res.instance.n;
    const givenIdx = res.instance.givens.findIndex((v) => v !== 0);
    const emptyIdx = res.instance.givens.findIndex((v) => v === 0);
    const state = { cells: [...res.instance.givens] };
    expect(grecolatin.validateMove(res.instance, state, { index: givenIdx, value: 1 }).ok).toBe(false);
    expect(grecolatin.validateMove(res.instance, state, { index: emptyIdx, value: n * n + 1 }).ok).toBe(false);
    expect(grecolatin.validateMove(res.instance, state, { index: emptyIdx, value: 1 }).ok).toBe(true);
  });
});
