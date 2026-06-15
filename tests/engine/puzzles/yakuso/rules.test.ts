import { describe, it, expect } from 'vitest';
import { combinations, isCompleteSolution, serializeInstance, deserializeInstance, serializeSolution, deserializeSolution } from '../../../../src/engine/puzzles/yakuso/rules';
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

  it('round-trips instance and solution serialization (clues nulls preserved)', () => {
    const inst: YakusoInstance = { rows: 3, cols: 4, totals: [5, 1, 5, 3], clues: [2, null, null, 0, null, 1, null, null, 3, null, 3, null] };
    expect(deserializeInstance(serializeInstance(inst))).toEqual(inst);
    const sol = [2, 0, 2, 0, 0, 1, 0, 0, 3, 0, 3, 3];
    expect(deserializeSolution(serializeSolution(sol))).toEqual(sol);
  });
});
