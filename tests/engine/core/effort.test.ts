import { describe, it, expect } from 'vitest';
import { measureEffort, type EffortModel } from '../../../src/engine/core/effort';
import { bandFromEffort } from '../../../src/engine/core/difficulty';

// A trivial 1-D "Latin row" puzzle of length L: cells 0..L-1, each must be 1..L distinct.
function rowModel(L: number): EffortModel {
  return {
    cellCount: L,
    candidates(grid, i) {
      if (grid[i] !== 0) return [];
      const used = new Set(grid.filter((v) => v !== 0));
      const out: number[] = [];
      for (let v = 1; v <= L; v++) if (!used.has(v)) out.push(v);
      return out;
    }
  };
}

describe('measureEffort', () => {
  it('a fully-given grid needs zero guesses', () => {
    expect(measureEffort([1, 2, 3], rowModel(3))).toBe(0);
  });
  it('a grid solvable by forced singles needs zero guesses', () => {
    // [0,2,3] → cell 0 forced to 1
    expect(measureEffort([0, 2, 3], rowModel(3))).toBe(0);
  });
  it('an empty grid needs guesses (>0)', () => {
    // [0,0,0] → first cell has 3 candidates → must guess
    expect(measureEffort([0, 0, 0], rowModel(3))).toBeGreaterThan(0);
  });
  it('returns Infinity for an unsatisfiable grid', () => {
    // length 2 row with a repeated given is impossible to complete validly...
    // use a contradictory partial: both cells must be distinct but candidates run out
    // grid [0,0] with an extra constraint is hard to express here; instead test a 0-candidate cell:
    const bad: EffortModel = { cellCount: 1, candidates: () => [] };
    expect(measureEffort([0], bad)).toBe(Infinity);
  });
});

describe('bandFromEffort', () => {
  it('maps effort to bands', () => {
    expect(bandFromEffort(0, 2, 6)).toBe('easy');
    expect(bandFromEffort(1, 2, 6)).toBe('medium');
    expect(bandFromEffort(2, 2, 6)).toBe('medium');
    expect(bandFromEffort(5, 2, 6)).toBe('hard');
    expect(bandFromEffort(99, 2, 6)).toBe('expert');
    expect(bandFromEffort(Infinity, 2, 6)).toBe('expert');
  });
});
