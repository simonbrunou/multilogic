import { describe, it, expect } from 'vitest';
import { combinations, isCompleteSolution, totalCaps, totalsSatisfied, serializeInstance, deserializeInstance, serializeSolution, deserializeSolution } from '../../../../src/engine/puzzles/yakuso/rules';
import type { YakusoInstance } from '../../../../src/engine/puzzles/yakuso/types';

describe('yakuso rules', () => {
  it('combinations enumerates n-choose-k', () => {
    expect(combinations([0, 1, 2, 3], 2)).toHaveLength(6);
    expect(combinations([0, 1, 2], 0)).toEqual([[]]);
    expect(combinations([0, 1, 2], 3)).toEqual([[0, 1, 2]]);
  });

  it('isCompleteSolution rejects mixed digits, wrong counts and bad totals', () => {
    const totals = [5, 1, 5, 3];
    const inst: YakusoInstance = { rows: 3, cols: 4, totals, clues: new Array(12).fill(null) };
    expect(isCompleteSolution(inst, [2, 0, 2, 0, 0, 1, 0, 0, 3, 0, 3, 3])).toBe(true);
    expect(isCompleteSolution(inst, [2, 0, 3, 0, 0, 1, 0, 0, 3, 0, 3, 3])).toBe(false); // mixed digits row 0
    expect(isCompleteSolution(inst, [2, 0, 0, 0, 0, 1, 0, 0, 3, 0, 3, 3])).toBe(false); // wrong count + totals
  });

  it('totalCaps reconstructs a single hidden total and caps multiple by the joint budget', () => {
    // example totals [5,1,5,3] sum to 14 = 1²+2²+3²; one hidden comes back exactly.
    const full = [5, 1, 5, 3];
    for (let h = 0; h < 4; h++) {
      const totals = full.map((t, c) => (c === h ? null : t));
      const inst: YakusoInstance = { rows: 3, cols: 4, totals, clues: new Array(12).fill(null) };
      expect(totalCaps(inst)).toEqual(full);
    }
    // with no hidden total the caps equal the shown totals
    const shown: YakusoInstance = { rows: 3, cols: 4, totals: full, clues: new Array(12).fill(null) };
    expect(totalCaps(shown)).toEqual(full);
    // two hidden columns share the joint budget (14 − shown 6 = 8) as their cap
    const two: YakusoInstance = { rows: 3, cols: 4, totals: [null, 1, 5, null], clues: new Array(12).fill(null) };
    expect(totalCaps(two)).toEqual([8, 1, 5, 8]);
  });

  it('totalsSatisfied: shown totals match exactly, hidden columns satisfy only their joint sum', () => {
    const inst: YakusoInstance = { rows: 3, cols: 4, totals: [null, 1, 5, null], clues: new Array(12).fill(null) };
    // the two hidden columns (0 and 3) must sum to 8; column splits 5/3 and 3/5 both pass
    expect(totalsSatisfied(inst, [5, 1, 5, 3])).toBe(true);
    expect(totalsSatisfied(inst, [3, 1, 5, 5])).toBe(true);
    // joint sum wrong → fails
    expect(totalsSatisfied(inst, [4, 1, 5, 3])).toBe(false);
    // a shown total mismatched → fails even if the hidden budget would balance
    expect(totalsSatisfied(inst, [6, 2, 5, 1])).toBe(false);
    // single-hidden case still pins the lone column exactly
    const one: YakusoInstance = { rows: 3, cols: 4, totals: [5, 1, 5, null], clues: new Array(12).fill(null) };
    expect(totalsSatisfied(one, [5, 1, 5, 3])).toBe(true);
    expect(totalsSatisfied(one, [5, 1, 5, 2])).toBe(false);
  });

  it('round-trips instance and solution serialization (clues nulls preserved)', () => {
    const inst: YakusoInstance = { rows: 3, cols: 4, totals: [5, 1, 5, 3], clues: [2, null, null, 0, null, 1, null, null, 3, null, 3, null] };
    expect(deserializeInstance(serializeInstance(inst))).toEqual(inst);
    const sol = [2, 0, 2, 0, 0, 1, 0, 0, 3, 0, 3, 3];
    expect(deserializeSolution(serializeSolution(sol))).toEqual(sol);
  });
});
