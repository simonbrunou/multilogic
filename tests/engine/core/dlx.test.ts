import { describe, it, expect } from 'vitest';
import { Dlx } from '../../../src/engine/core/dlx';

describe('Dlx exact cover', () => {
  // Classic Knuth example: columns {1..7}, find subset of rows covering each column once.
  // Rows (1-indexed columns): A={1,4,7} B={1,4} C={4,5,7} D={3,5,6} E={2,3,6,7} F={2,7}
  // Unique exact cover = {B, D, F}.
  function buildKnuth(): Dlx {
    const dlx = new Dlx(7);
    dlx.addRow(0, [0, 3, 6]); // A
    dlx.addRow(1, [0, 3]);    // B
    dlx.addRow(2, [3, 4, 6]); // C
    dlx.addRow(3, [2, 4, 5]); // D
    dlx.addRow(4, [1, 2, 5, 6]); // E
    dlx.addRow(5, [1, 6]);    // F
    return dlx;
  }

  it('finds the unique exact cover', () => {
    const sols = buildKnuth().solve();
    expect(sols.length).toBe(1);
    expect([...sols[0]].sort((a, b) => a - b)).toEqual([1, 3, 5]); // B, D, F
  });

  it('respects the solution limit (stop-at-N)', () => {
    const sols = buildKnuth().solve(1);
    expect(sols.length).toBe(1);
  });

  it('returns no solutions when none exist', () => {
    const dlx = new Dlx(3);
    dlx.addRow(0, [0]); // can never cover columns 1 and 2
    expect(dlx.solve().length).toBe(0);
  });

  it('counts multiple solutions up to the limit', () => {
    // Two columns, two single-column rows each → 1 exact cover; build an ambiguous one instead:
    const dlx = new Dlx(2);
    dlx.addRow(0, [0, 1]); // covers both
    dlx.addRow(1, [0, 1]); // also covers both → two distinct single-row covers
    const sols = dlx.solve(5);
    expect(sols.length).toBe(2);
  });
});
