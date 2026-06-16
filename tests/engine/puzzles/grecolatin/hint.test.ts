import { describe, it, expect } from 'vitest';
import { hintCell, getHint } from '../../../../src/engine/puzzles/grecolatin/hint';
import { generateForDifficulty, buildSquare } from '../../../../src/engine/puzzles/grecolatin/generator';
import { encodePair, validateGrid } from '../../../../src/engine/puzzles/grecolatin/rules';
import { analyze, candidatesAt } from '../../../../src/engine/puzzles/grecolatin/candidates';
import { createPrng } from '../../../../src/engine/core/prng';
import type { GrecoLatinInstance } from '../../../../src/engine/puzzles/grecolatin/types';

const n = 3;
function fullSquare(): number[] {
  const c: number[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c.push(encodePair((i + j) % n, (i + 2 * j) % n, n));
  return c;
}

function emptyInst(sz: number): GrecoLatinInstance {
  return { n: sz, digitClues: new Array(sz * sz).fill(null), letterClues: new Array(sz * sz).fill(null) };
}

function fullInst(sz: number, cells: number[]): GrecoLatinInstance {
  return {
    n: sz,
    digitClues: cells.map((v) => v !== 0 ? Math.floor((v - 1) / sz) : null),
    letterClues: cells.map((v) => v !== 0 ? (v - 1) % sz : null)
  };
}

describe('grecolatin hint', () => {
  it('forced single: blanking one cell of a complete square yields the only valid pair', () => {
    const cells = fullSquare();
    const removed = cells[4];
    cells[4] = 0;
    const h = hintCell(emptyInst(n), cells);
    expect(h).not.toBeNull();
    expect(h!.index).toBe(4);
    // The hint returns the forced a or b; verify at least one is non-null
    expect(h!.a !== null || h!.b !== null).toBe(true);
    // The forced value must match the removed pair
    const removedA = Math.floor((removed - 1) / n);
    const removedB = (removed - 1) % n;
    if (h!.a !== null) expect(h!.a).toBe(removedA);
    if (h!.b !== null) expect(h!.b).toBe(removedB);
  });

  it('a hint on generated clues is a placement that keeps the grid valid', () => {
    const g = generateForDifficulty(createPrng('h1'), 'medium', 5);
    const cells = new Array(25).fill(0);
    const h = hintCell(g.instance, cells);
    expect(h).not.toBeNull();
    // Build current known from clues
    const knownA = [...g.instance.digitClues];
    const knownB = [...g.instance.letterClues];
    if (h!.a !== null) knownA[h!.index] = h!.a;
    if (h!.b !== null) knownB[h!.index] = h!.b;
    // Build a cell grid from the known state where both dims known
    const cellsAfter = knownA.map((a, i) => a !== null && knownB[i] !== null ? a * 5 + (knownB[i] as number) + 1 : 0);
    expect(validateGrid(5, cellsAfter).valid).toBe(true);
  });

  it('getHint returns null on a full valid grid', () => {
    expect(getHint(emptyInst(n), { cells: fullSquare() })).toBeNull();
  });

  it('getHint returns a Hint with the cell index and descriptive text', () => {
    const cells = fullSquare();
    cells[0] = 0;
    const h = getHint(emptyInst(n), { cells });
    expect(h).not.toBeNull();
    expect(h!.cells).toEqual([0]);
    expect(typeof h!.text).toBe('string');
  });

  it('hintCell returns a valid completion-hint on a near-complete large (8x8) grid', () => {
    const sol = buildSquare(8, createPrng(5))!;
    const givenCells = sol.map((v, i) => (i % 9 === 0 ? v : 0));
    const cells = sol.map((v, i) => (i % 9 === 0 || i > 57 ? 0 : v));
    const inst = fullInst(8, givenCells);
    const r = hintCell(inst, cells);
    expect(r).not.toBeNull();
    // Verify the hint index is open
    const knownA = [...inst.digitClues];
    const knownB = [...inst.letterClues];
    expect(knownA[r!.index] === null || knownB[r!.index] === null).toBe(true);
    // Verify the hint value is a valid candidate
    // Merge clues+cells
    for (let i = 0; i < 64; i++) {
      const v = cells[i] || 0;
      if (knownA[i] === null && v !== 0) knownA[i] = Math.floor((v - 1) / 8);
      if (knownB[i] === null && v !== 0) knownB[i] = (v - 1) % 8;
    }
    const an = analyze(8, knownA, knownB);
    const cands = candidatesAt(8, an, knownA, knownB, r!.index);
    if (r!.a !== null) expect(cands.some((c) => c.a === r!.a)).toBe(true);
    if (r!.b !== null) expect(cands.some((c) => c.b === r!.b)).toBe(true);
  });

  it('hintCell returns BOUNDED (never freezes) on a very sparse large (9x9) grid', () => {
    const sol = buildSquare(9, createPrng(11))!;
    const givenCells = sol.map((v, i) => (i < 4 ? v : 0));
    const inst = fullInst(9, givenCells);
    const r = hintCell(inst, new Array(81).fill(0));
    expect(r === null || (r.a !== null || r.b !== null)).toBe(true);
  });
});
