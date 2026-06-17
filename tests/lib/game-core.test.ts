import { describe, it, expect } from 'vitest';
import { SudokuGame } from '../../src/lib/game-core';
import { gridFromString } from '../../src/engine/puzzles/sudoku/rules';

const SOLUTION =
  '534678912' + '672195348' + '198342567' +
  '859761423' + '426853791' + '713924856' +
  '961537284' + '287419635' + '345286179';
const GIVENS = (() => { const g = gridFromString(SOLUTION); g[2] = 0; g[80] = 0; return g; })();

function game(): SudokuGame {
  return new SudokuGame([...GIVENS], gridFromString(SOLUTION));
}

describe('SudokuGame', () => {
  it('input fills an empty cell and undo reverts it', () => {
    const g = game();
    g.input(2, 4);
    expect(g.cells[2]).toBe(4);
    g.undo();
    expect(g.cells[2]).toBe(0);
    g.redo();
    expect(g.cells[2]).toBe(4);
  });

  it('refuses to overwrite a given cell', () => {
    const g = game();
    expect(g.input(0, 7)).toBe(false);
    expect(g.cells[0]).toBe(5);
  });

  it('erase clears a filled cell', () => {
    const g = game();
    g.input(2, 4);
    g.erase(2);
    expect(g.cells[2]).toBe(0);
  });

  it('toggleNote adds and removes a candidate', () => {
    const g = game();
    g.toggleNote(2, 4);
    expect([...g.notes[2]]).toContain(4);
    g.toggleNote(2, 4);
    expect([...g.notes[2]]).not.toContain(4);
  });

  it('placing a value clears that cell notes', () => {
    const g = game();
    g.toggleNote(2, 4);
    g.input(2, 4);
    expect(g.notes[2].size).toBe(0);
  });

  it('conflicts flags a value duplicated among peers', () => {
    const g = game();
    g.input(2, 5);
    expect(g.conflicts().has(2)).toBe(true);
  });

  it('isSolved is true only when the grid matches the solution', () => {
    const g = game();
    expect(g.isSolved()).toBe(false);
    g.input(2, 4);
    g.input(80, 9);
    expect(g.isSolved()).toBe(true);
  });

  it('restore reloads cells + notes and clears undo history (for resuming a saved game)', () => {
    const g = game();
    const cells = [...GIVENS];
    cells[2] = 4;
    g.restore(cells, [[5, [1, 2, 3]]]);
    expect(g.cells[2]).toBe(4);
    expect([...g.notes[5]].sort()).toEqual([1, 2, 3]);
    // History was wiped, so there is nothing to undo back to.
    g.undo();
    expect(g.cells[2]).toBe(4);
  });
});
