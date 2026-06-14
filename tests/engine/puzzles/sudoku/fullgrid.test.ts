import { describe, it, expect } from 'vitest';
import { generateFullGrid } from '../../../../src/engine/puzzles/sudoku/fullgrid';
import { solveComplete } from '../../../../src/engine/puzzles/sudoku/solver';
import { gridToString } from '../../../../src/engine/puzzles/sudoku/rules';
import { createPrng } from '../../../../src/engine/core/prng';

function isValidFull(g: number[]): boolean {
  if (g.some((v) => v < 1 || v > 9)) return false;
  const seen = (idxs: number[]) => {
    const s = new Set(idxs.map((i) => g[i]));
    return s.size === 9;
  };
  for (let i = 0; i < 9; i++) {
    if (!seen([...Array(9)].map((_, c) => i * 9 + c))) return false;       // row
    if (!seen([...Array(9)].map((_, r) => r * 9 + i))) return false;       // col
    const br = Math.floor(i / 3) * 3, bc = (i % 3) * 3;
    const box = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box.push((br + r) * 9 + (bc + c));
    if (!seen(box)) return false;                                          // box
  }
  return true;
}

describe('generateFullGrid', () => {
  it('produces a valid complete grid', () => {
    const g = generateFullGrid(createPrng('grid-1'));
    expect(isValidFull(g)).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const a = generateFullGrid(createPrng('same'));
    const b = generateFullGrid(createPrng('same'));
    expect(gridToString(a)).toBe(gridToString(b));
  });

  it('different seeds produce distinct grids (across many seeds)', () => {
    const seeds = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'];
    const grids = seeds.map((s) => gridToString(generateFullGrid(createPrng(s))));
    expect(new Set(grids).size).toBe(seeds.length); // all distinct
  });

  it('the generated grid is itself a uniquely-solvable complete board', () => {
    const g = generateFullGrid(createPrng('unique'));
    expect(solveComplete({ givens: g }, 2).count).toBe(1);
  });
});
