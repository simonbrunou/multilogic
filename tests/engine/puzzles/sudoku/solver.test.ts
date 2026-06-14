import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { solveComplete, solveOne } from '../../../../src/engine/puzzles/sudoku/solver';
import { gridFromString, gridToString } from '../../../../src/engine/puzzles/sudoku/rules';

const PUZZLE =
  '53..7....' + '6..195...' + '.98....6.' +
  '8...6...3' + '4..8.3..1' + '7...2...6' +
  '.6....28.' + '...419..5' + '....8..79';
const SOLUTION =
  '534678912' + '672195348' + '198342567' +
  '859761423' + '426853791' + '713924856' +
  '961537284' + '287419635' + '345286179';

describe('sudoku solver', () => {
  it('solves a valid puzzle to the known solution', () => {
    const inst = { givens: gridFromString(PUZZLE) };
    const sol = solveOne(inst);
    expect(sol).not.toBeNull();
    expect(gridToString(sol!)).toBe(SOLUTION);
  });

  it('reports exactly one solution for a unique puzzle (oracle)', () => {
    const inst = { givens: gridFromString(PUZZLE) };
    const res = solveComplete(inst, 2);
    expect(res.count).toBe(1);
  });

  it('detects multiple solutions for an under-constrained grid', () => {
    const inst = { givens: gridFromString('0'.repeat(81)) };
    const res = solveComplete(inst, 2);
    expect(res.count).toBe(2); // capped at the limit
  });

  it('reports zero solutions for a contradictory grid', () => {
    // two 5s in the first row → no valid completion
    const inst = { givens: gridFromString('55' + '0'.repeat(79)) };
    const res = solveComplete(inst, 2);
    expect(res.count).toBe(0);
    expect(res.solution).toBeNull();
  });

  it('property: solving the solution returns the solution unchanged', () => {
    const inst = { givens: gridFromString(SOLUTION) };
    const res = solveComplete(inst, 2);
    expect(res.count).toBe(1);
    expect(gridToString(res.solution!)).toBe(SOLUTION);
  });

  it('property: solver is deterministic for random sub-grids of the solution', () => {
    const sol = gridFromString(SOLUTION);
    fc.assert(fc.property(
      fc.array(fc.boolean(), { minLength: 81, maxLength: 81 }),
      (keep) => {
        const givens = sol.map((v, i) => (keep[i] ? v : 0));
        const a = solveOne({ givens: [...givens] });
        const b = solveOne({ givens: [...givens] });
        // both runs agree (either both null, or identical grids)
        const sa = a ? gridToString(a) : null;
        const sb = b ? gridToString(b) : null;
        return sa === sb;
      }
    ));
  });
});
