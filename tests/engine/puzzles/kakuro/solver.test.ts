import { describe, it, expect } from 'vitest';
import { solveComplete, fill } from '../../../../src/engine/puzzles/kakuro/solver';
import { deriveClues, allRuns } from '../../../../src/engine/puzzles/kakuro/rules';
import { createPrng } from '../../../../src/engine/core/prng';
import type { KakuroInstance } from '../../../../src/engine/puzzles/kakuro/types';

const black = [true, true, true, true, false, false, true, false, false];
const base: KakuroInstance = { width: 3, height: 3, black, clues: black.map((b) => (b ? {} : null)) };

function valid(inst: KakuroInstance, sol: number[]): boolean {
  for (const run of allRuns(inst)) {
    if (run.clueIndex < 0) continue;
    const vals = run.cells.map((i) => sol[i]);
    if (new Set(vals).size !== vals.length) return false; // distinct
    const clue = inst.clues[run.clueIndex]!;
    const target = run.dir === 'h' ? clue.right : clue.down;
    if (target !== undefined && vals.reduce((s, v) => s + v, 0) !== target) return false;
  }
  return true;
}

describe('kakuro solver', () => {
  it('fill produces a distinct-respecting filling deterministically', () => {
    const a = fill(base, createPrng('k1'));
    const b = fill(base, createPrng('k1'));
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    // white cells (4,5,7,8) all in 1..9
    for (const i of [4, 5, 7, 8]) { expect(a![i]).toBeGreaterThanOrEqual(1); expect(a![i]).toBeLessThanOrEqual(9); }
  });

  it('solveComplete on derived clues finds the fill and validates', () => {
    const sol = fill(base, createPrng('k2'))!;
    const inst: KakuroInstance = { ...base, clues: deriveClues(base, sol) };
    const res = solveComplete(inst, 2);
    expect(res.count).toBeGreaterThanOrEqual(1);
    expect(valid(inst, res.solution!)).toBe(true);
  });

  it('a contradictory clue (impossible sum) yields zero solutions', () => {
    // 2-cell run with clue 1 is impossible (min distinct sum is 1+2=3)
    const inst: KakuroInstance = { ...base, clues: base.black.map((b, i) => (i === 3 ? { right: 1 } : b ? {} : null)) };
    expect(solveComplete(inst, 2).count).toBe(0);
  });
});
