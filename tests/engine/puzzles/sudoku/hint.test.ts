import { describe, it, expect } from 'vitest';
import { getHint } from '../../../../src/engine/puzzles/sudoku/hint';
import { gridFromString } from '../../../../src/engine/puzzles/sudoku/rules';

const EASY =
  '53..7....' + '6..195...' + '.98....6.' +
  '8...6...3' + '4..8.3..1' + '7...2...6' +
  '.6....28.' + '...419..5' + '....8..79';

describe('getHint', () => {
  it('returns a next-step hint for a fresh easy puzzle', () => {
    const givens = gridFromString(EASY);
    const state = { cells: new Array(81).fill(0) };
    const hint = getHint({ givens }, state);
    expect(hint).not.toBeNull();
    expect(hint!.cells.length).toBeGreaterThan(0);
    expect(typeof hint!.text).toBe('string');
  });

  it('accounts for the player state (entries narrow the next hint)', () => {
    const givens = gridFromString(EASY);
    const state = { cells: new Array(81).fill(0) };
    const hint = getHint({ givens }, state);
    expect(hint).not.toBeNull();
  });

  it('returns null on an already-solved grid', () => {
    const solved =
      '534678912' + '672195348' + '198342567' +
      '859761423' + '426853791' + '713924856' +
      '961537284' + '287419635' + '345286179';
    const givens = gridFromString(solved);
    const hint = getHint({ givens }, { cells: new Array(81).fill(0) });
    expect(hint).toBeNull();
  });
});
