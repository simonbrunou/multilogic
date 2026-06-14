import { describe, it, expect } from 'vitest';
import { hintCell, getHint } from '../../../../src/engine/puzzles/grecolatin/hint';
import { generateForDifficulty } from '../../../../src/engine/puzzles/grecolatin/generator';
import { encodePair, validateGrid } from '../../../../src/engine/puzzles/grecolatin/rules';
import { createPrng } from '../../../../src/engine/core/prng';

const n = 3;
function fullSquare(): number[] {
  const c: number[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c.push(encodePair((i + j) % n, (i + 2 * j) % n, n));
  return c;
}

describe('grecolatin hint', () => {
  it('forced single: blanking one cell of a complete square yields the only valid pair', () => {
    const cells = fullSquare();
    const removed = cells[4];
    cells[4] = 0;
    const h = hintCell({ n, givens: new Array(9).fill(0) }, cells);
    expect(h).not.toBeNull();
    expect(h!.index).toBe(4);
    expect(h!.value).toBe(removed);
  });

  it('a hint on generated givens is a placement that keeps the grid valid', () => {
    const g = generateForDifficulty(createPrng('h1'), 'medium', 5);
    const cells = [...g.instance.givens];
    const h = hintCell({ n: 5, givens: g.instance.givens }, cells);
    expect(h).not.toBeNull();
    cells[h!.index] = h!.value;
    expect(validateGrid(5, cells).valid).toBe(true);
  });

  it('getHint returns null on a full valid grid', () => {
    expect(getHint({ n, givens: new Array(9).fill(0) }, { cells: fullSquare() })).toBeNull();
  });

  it('getHint returns a Hint with the cell index and descriptive text', () => {
    const cells = fullSquare();
    cells[0] = 0;
    const h = getHint({ n, givens: new Array(9).fill(0) }, { cells });
    expect(h).not.toBeNull();
    expect(h!.cells).toEqual([0]);
    expect(typeof h!.text).toBe('string');
  });
});
