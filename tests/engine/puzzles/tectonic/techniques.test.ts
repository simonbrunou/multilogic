import { describe, it, expect } from 'vitest';
import { makeCtx, nakedSingle, hiddenSingleRegion, nakedPairRegion, kingPointing } from '../../../../src/engine/puzzles/tectonic/techniques';
import type { TectonicInstance } from '../../../../src/engine/puzzles/tectonic/types';

const ONE_REGION_4: TectonicInstance = { width: 4, height: 1, regions: [0, 0, 0, 0], givens: [0, 0, 0, 0] };

describe('tectonic techniques', () => {
  it('nakedSingle places a forced cell', () => {
    const ctx = makeCtx(ONE_REGION_4);
    ctx.cand[0] = new Set([3]);
    expect(nakedSingle(ctx)).toBe(true);
    expect(ctx.grid[0]).toBe(3);
    expect(ctx.cand[1].has(3)).toBe(false);
  });

  it('hiddenSingleRegion places a digit with one home in the region', () => {
    const ctx = makeCtx(ONE_REGION_4);
    ctx.cand[0] = new Set([1, 2]);
    ctx.cand[1] = new Set([1, 2]);
    ctx.cand[2] = new Set([1, 2, 3]);
    ctx.cand[3] = new Set([3, 4]);
    expect(hiddenSingleRegion(ctx)).toBe(true);
    expect(ctx.grid[3]).toBe(4);
  });

  it('nakedPairRegion clears the pair digits from the region\'s other cells', () => {
    const ctx = makeCtx(ONE_REGION_4);
    ctx.cand[0] = new Set([1, 2]);
    ctx.cand[1] = new Set([1, 2]);
    ctx.cand[2] = new Set([1, 2, 3]);
    ctx.cand[3] = new Set([1, 2, 4]);
    expect(nakedPairRegion(ctx)).toBe(true);
    expect(ctx.cand[2].has(1)).toBe(false);
    expect(ctx.cand[2].has(2)).toBe(false);
    expect(ctx.cand[2].has(3)).toBe(true);
  });

  it('kingPointing eliminates a digit from a cell adjacent to all of a region\'s candidate cells', () => {
    const inst: TectonicInstance = { width: 2, height: 2, regions: [0, 0, 1, 2], givens: [0, 0, 0, 0] };
    const ctx = makeCtx(inst);
    ctx.cand[0] = new Set([1, 2]);
    ctx.cand[1] = new Set([1, 2]);
    ctx.cand[2] = new Set([1]);
    expect(kingPointing(ctx)).toBe(true);
    expect(ctx.cand[2].has(1)).toBe(false);
  });
});
