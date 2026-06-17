import { describe, it, expect } from 'vitest';
import { getHint } from '../../../../src/engine/puzzles/yakuso/hint';
import { generateForDifficulty } from '../../../../src/engine/puzzles/yakuso/generator';
import { createPrng } from '../../../../src/engine/core/prng';

describe('yakuso hint', () => {
  it('points at a blank, non-given interior cell whose solution value is non-zero', () => {
    const g = generateForDifficulty(createPrng('hint-1'), 'medium');
    const cells = g.instance.clues.map((c) => c ?? 0); // start: only givens filled
    const h = getHint(g.instance, { cells });
    expect(h).not.toBeNull();
    const i = h!.cells[0];
    expect(g.instance.clues[i]).toBeNull();   // not a given
    expect(cells[i]).toBe(0);                  // currently blank
    expect(g.solution[i]).not.toBe(0);         // a digit to place
    expect(h!.text).toContain(String(g.solution[i]));
  });

  it('guides crossing out a blank zero once every digit is placed', () => {
    const g = generateForDifficulty(createPrng('hint-2'), 'easy');
    // Every digit placed, but the solution-zero cells are still blank (0) — the board is not
    // finished under the new win check, so the hint must point at a zero to cross out.
    const h = getHint(g.instance, { cells: [...g.solution] });
    expect(h).not.toBeNull();
    const i = h!.cells[0];
    expect(g.instance.clues[i]).toBeNull(); // not a given
    expect(g.solution[i]).toBe(0);          // a zero to cross out
    expect(h!.text).toBe('Cross out');      // labelled as a cross-out, not "Place 0"
  });

  it('returns null once every cell is filled or crossed out', () => {
    const g = generateForDifficulty(createPrng('hint-2'), 'easy');
    // Crossed-out zeros read as a non-zero entry (the play layer uses MARKED_ZERO = -1).
    const cells = g.solution.map((v) => (v === 0 ? -1 : v));
    expect(getHint(g.instance, { cells })).toBeNull();
  });
});
