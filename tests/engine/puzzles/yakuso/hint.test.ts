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

  it('returns null when every non-zero cell is already placed', () => {
    const g = generateForDifficulty(createPrng('hint-2'), 'easy');
    const h = getHint(g.instance, { cells: [...g.solution] });
    expect(h).toBeNull();
  });
});
