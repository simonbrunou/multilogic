import { describe, it, expect } from 'vitest';
import { grecolatin } from '../../../../src/engine/puzzles/grecolatin/index';
import { getModule } from '../../../../src/engine/puzzles/registry';
import { validateGrid } from '../../../../src/engine/puzzles/grecolatin/rules';
import { buildSquare } from '../../../../src/engine/puzzles/grecolatin/generator';
import { createPrng } from '../../../../src/engine/core/prng';

function sig(): AbortSignal { return new AbortController().signal; }

describe('grecolatin module', () => {
  it('is a registered construction puzzle with the seam', () => {
    expect(grecolatin.type).toBe('grecolatin');
    expect(grecolatin.kind).toBe('construction');
    expect(getModule('grecolatin').type).toBe('grecolatin');
    expect(typeof grecolatin.serializeInstance).toBe('function');
  });

  it('generate yields conflict-free clues and round-trips serialization', async () => {
    const res = await grecolatin.generate({ difficulty: 'easy', prng: createPrng('m1'), signal: sig() });
    // Cells where both dims known must be conflict-free
    const n = res.instance.n;
    const cells = res.instance.digitClues.map((a, i) =>
      a !== null && res.instance.letterClues[i] !== null ? a * n + (res.instance.letterClues[i] as number) + 1 : 0
    );
    expect(validateGrid(n, cells).valid).toBe(true);
    expect(grecolatin.deserializeInstance(grecolatin.serializeInstance(res.instance))).toEqual(res.instance);
    expect(res.solution).toBeNull();
  });

  it('validate scores a partial vs complete grid', async () => {
    const res = await grecolatin.generate({ difficulty: 'easy', prng: createPrng('m2'), signal: sig() });
    const n = res.instance.n;
    // Build cells from clues (both dims)
    const clueCells = res.instance.digitClues.map((a, i) =>
      a !== null && res.instance.letterClues[i] !== null ? a * n + (res.instance.letterClues[i] as number) + 1 : 0
    );
    const partial = grecolatin.validate(res.instance, { cells: clueCells });
    expect(partial.complete).toBe(false);
    expect(partial.valid).toBe(true);
    expect(partial.score).toBeGreaterThan(0);
  });

  it('validateMove rejects fully-given cells and out-of-range pair codes', async () => {
    const res = await grecolatin.generate({ difficulty: 'easy', prng: createPrng('m3'), signal: sig() });
    const n = res.instance.n;
    const fullyGivenIdx = res.instance.digitClues.findIndex((a, i) => a !== null && res.instance.letterClues[i] !== null);
    const openIdx = res.instance.digitClues.findIndex((a, i) => a === null || res.instance.letterClues[i] === null);
    const state = { cells: new Array(n * n).fill(0) };
    if (fullyGivenIdx >= 0) {
      expect(grecolatin.validateMove(res.instance, state, { index: fullyGivenIdx, value: 1 }).ok).toBe(false);
    }
    if (openIdx >= 0) {
      expect(grecolatin.validateMove(res.instance, state, { index: openIdx, value: n * n + 1 }).ok).toBe(false);
      expect(grecolatin.validateMove(res.instance, state, { index: openIdx, value: 1 }).ok).toBe(true);
    }
  });

  it('a partial-clue instance filled to a full square validates as complete and valid', async () => {
    const sol = buildSquare(5, createPrng('m4'))!;
    const n = 5;
    // Only reveal first 8 cells as partial clues
    const digitClues = sol.map((v, i) => i < 8 ? Math.floor((v - 1) / n) : null);
    const letterClues = sol.map((v, i) => i < 8 ? (v - 1) % n : null);
    const inst = { n, digitClues, letterClues };
    // State has the rest filled per the full square
    const cells = sol.map((v, i) => i < 8 ? 0 : v);
    const result = grecolatin.validate(inst, { cells });
    expect(result.complete).toBe(true);
    expect(result.valid).toBe(true);
  });
});
