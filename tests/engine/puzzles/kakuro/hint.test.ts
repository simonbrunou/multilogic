import { describe, it, expect } from 'vitest';
import { getHint } from '../../../../src/engine/puzzles/kakuro/hint';
import type { KakuroInstance } from '../../../../src/engine/puzzles/kakuro/types';

const forced: KakuroInstance = {
  width: 3, height: 2,
  black: [true, true, true, true, false, false],
  clues: [{}, { down: 1 }, { down: 2 }, { right: 3 }, null, null]
};

describe('kakuro getHint', () => {
  it('finds a forced cell from the empty state', () => {
    const hint = getHint(forced, { cells: [0, 0, 0, 0, 0, 0] });
    expect(hint).not.toBeNull();
    expect(hint!.cells.length).toBe(1);
    // cell 4 is forced to 1 (its single-cell vertical run sums to 1)
    expect(hint!.cells[0]).toBe(4);
  });
  it('returns null on a solved grid', () => {
    const hint = getHint(forced, { cells: [0, 0, 0, 0, 1, 2] });
    expect(hint).toBeNull();
  });
});
