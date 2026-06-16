import { describe, it, expect } from 'vitest';
import { hintCell, getHint } from '../../../../src/engine/puzzles/grecolatin/hint';
import { generateForDifficulty, buildSquare } from '../../../../src/engine/puzzles/grecolatin/generator';
import { encodePair, validateGrid, decodePair } from '../../../../src/engine/puzzles/grecolatin/rules';
import { analyze, candidatesAt } from '../../../../src/engine/puzzles/grecolatin/candidates';
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

  it('hintCell returns a legal move quickly on a sparse large (8x8) grid (no freeze)', () => {
    // Use one given per row (indices 0,8,16,...) so every row/col has some constraint;
    // put the rest of the solution in `cells` as player progress, leaving 6 empties.
    const sol = buildSquare(8, createPrng(5))!;
    const givens = sol.map((v, i) => (i % 9 === 0 ? v : 0)); // 8 givens, one per row+col diagonal
    const cells = sol.map((v, i) => (i % 9 === 0 || i > 57 ? 0 : v)); // player filled all but last 6
    const r = hintCell({ n: 8, givens }, cells);
    expect(r).not.toBeNull();
    // the returned cell must actually be empty in the merged grid
    const merged = givens.map((g, i) => (g !== 0 ? g : cells[i]));
    expect(merged[r!.index]).toBe(0);
    const an = analyze(8, merged);
    const p = decodePair(r!.value, 8)!;
    expect(candidatesAt(8, an, r!.index).some((c) => c.a === p.a && c.b === p.b)).toBe(true);
  });

  it('hintCell completes a near-empty 9x9 grid without hanging', () => {
    // Spread one given per row so the solver has cross-row constraints from the start.
    const sol = buildSquare(9, createPrng(2))!;
    const givens = sol.map((v, i) => (i % 10 === 0 ? v : 0)); // 9 givens, one per row (diagonal)
    const cells = sol.map((v, i) => (i % 10 === 0 || i > 72 ? 0 : v)); // player filled all but last 8
    const r = hintCell({ n: 9, givens }, cells);
    expect(r).not.toBeNull();
  });
});
