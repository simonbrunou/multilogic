import { describe, it, expect } from 'vitest';
import { sudoku } from '../../../../src/engine/puzzles/sudoku/index';
import { gridFromString, gridToString } from '../../../../src/engine/puzzles/sudoku/rules';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import { DIFFICULTIES } from '../../../../src/engine/core/types';

function freshSignal(): AbortSignal {
  return new AbortController().signal;
}

describe('sudoku module', () => {
  it('declares the deduction-puzzle shape', () => {
    expect(sudoku.type).toBe('sudoku');
    expect(sudoku.kind).toBe('deduction');
    expect(typeof sudoku.generate).toBe('function');
    expect(typeof sudoku.solveComplete).toBe('function');
    expect(typeof sudoku.rate).toBe('function');
    expect(typeof sudoku.getHint).toBe('function');
  });

  it('generate returns a unique puzzle with a matching solution', async () => {
    const res = await sudoku.generate({ difficulty: 'easy', prng: createPrng('mod-1'), signal: freshSignal() });
    expect(sudoku.solveComplete(res.instance, 2).count).toBe(1);
    expect(gridToString(sudoku.solveComplete(res.instance, 1).solution!)).toBe(gridToString(res.solution!));
    expect(res.source).toBe('live');
  });

  it('generate is deterministic for a seed', async () => {
    const a = await sudoku.generate({ difficulty: 'medium', prng: createPrng('seed-x'), signal: freshSignal() });
    const b = await sudoku.generate({ difficulty: 'medium', prng: createPrng('seed-x'), signal: freshSignal() });
    expect(gridToString(a.instance.givens)).toBe(gridToString(b.instance.givens));
  });

  it('generate aborts when the signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      sudoku.generate({ difficulty: 'easy', prng: createPrng('abort'), signal: ctrl.signal })
    ).rejects.toThrow();
  });

  it('validateMove rejects edits to given cells and out-of-range values', () => {
    const givens = gridFromString('5' + '0'.repeat(80));
    const state = { cells: new Array(81).fill(0) };
    expect(sudoku.validateMove({ givens }, state, { index: 0, value: 3 }).ok).toBe(false);
    expect(sudoku.validateMove({ givens }, state, { index: 1, value: 10 }).ok).toBe(false);
    expect(sudoku.validateMove({ givens }, state, { index: 1, value: 7 }).ok).toBe(true);
    expect(sudoku.validateMove({ givens }, state, { index: 1, value: 0 }).ok).toBe(true);
  });

  it('validateMove rejects an out-of-range cell index', () => {
    const givens = gridFromString('5' + '0'.repeat(80));
    const state = { cells: new Array(81).fill(0) };
    expect(sudoku.validateMove({ givens }, state, { index: 81, value: 3 }).ok).toBe(false);
    expect(sudoku.validateMove({ givens }, state, { index: -1, value: 3 }).ok).toBe(false);
  });

  it('render exposes givens + cells for the UI', () => {
    const givens = gridFromString('5' + '0'.repeat(80));
    const state = { cells: new Array(81).fill(0) };
    const r = sudoku.render({ givens }, state) as { kind: string; givens: number[]; cells: number[] };
    expect(r.kind).toBe('grid9');
    expect(r.givens).toEqual(givens);
    expect(r.cells).toEqual(state.cells);
  });

  it('serialize/deserialize round-trips instance and solution', async () => {
    const res = await sudoku.generate({ difficulty: 'easy', prng: createPrng('seam'), signal: freshSignal() });
    expect(sudoku.deserializeInstance(sudoku.serializeInstance(res.instance))).toEqual(res.instance);
    expect(sudoku.deserializeSolution(sudoku.serializeSolution(res.solution!))).toEqual(res.solution);
  });

  it('generate returns an exactly in-band puzzle or throws — never a silent downgrade', async () => {
    for (const difficulty of DIFFICULTIES) {
      let got: string | null = null;
      for (let s = 0; s < 5 && got === null; s++) {
        const prng = createPrng(deriveSeed('sudoku', difficulty, 'module-exact', s));
        try {
          const res = await sudoku.generate({ difficulty, prng, signal: new AbortController().signal });
          expect(res.achievedDifficulty).toBe(difficulty); // exact, never downgraded
          expect(res.source).toBe('live');
          got = res.achievedDifficulty;
        } catch {
          // this prng's 60 attempts all missed the band; try the next seed
        }
      }
      expect(got, `exact ${difficulty} reachable within 5 prng seeds`).toBe(difficulty);
    }
  });
});
