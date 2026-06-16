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

  it('hintCell returns a valid completion-hint on a near-complete large (8x8) grid', () => {
    // Tractable case: player has filled all but the last 6 cells → completion is cheap.
    const sol = buildSquare(8, createPrng(5))!;
    const givens = sol.map((v, i) => (i % 9 === 0 ? v : 0)); // one given per row+col (diagonal)
    const cells = sol.map((v, i) => (i % 9 === 0 || i > 57 ? 0 : v)); // all but last 6 filled
    const r = hintCell({ n: 8, givens }, cells);
    expect(r).not.toBeNull();
    const merged = givens.map((g, i) => (g !== 0 ? g : cells[i]));
    expect(merged[r!.index]).toBe(0);
    const an = analyze(8, merged);
    const p = decodePair(r!.value, 8)!;
    expect(candidatesAt(8, an, r!.index).some((c) => c.a === p.a && c.b === p.b)).toBe(true);
  });

  it('hintCell returns BOUNDED (never freezes) on a very sparse large (9x9) grid', () => {
    // The real freeze risk: a near-empty 9x9. Completion is an intractable CSP here,
    // so the capped solver gives up fast and returns null — the test simply completing
    // (well under vitest's timeout) proves the hint never hangs. A null result is the
    // correct, responsive degradation (no forced move exists to hint anyway).
    const sol = buildSquare(9, createPrng(11))!;
    const givens = sol.map((v, i) => (i < 4 ? v : 0)); // only 4 givens, 77 empty
    const r = hintCell({ n: 9, givens }, new Array(81).fill(0));
    expect(r === null || (typeof r.value === 'number' && r.value >= 1)).toBe(true);
  });
});
