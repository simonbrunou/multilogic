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

  it('property: solving the solution returns the solution unchanged', () => {
    const inst = { givens: gridFromString(SOLUTION) };
    const res = solveComplete(inst, 2);
    expect(res.count).toBe(1);
    expect(gridToString(res.solution!)).toBe(SOLUTION);
  });

  it('property: solver output is deterministic across runs', () => {
    fc.assert(fc.property(fc.constant(PUZZLE), (p) => {
      const a = solveOne({ givens: gridFromString(p) });
      const b = solveOne({ givens: gridFromString(p) });
      return gridToString(a!) === gridToString(b!);
    }));
  });
});
