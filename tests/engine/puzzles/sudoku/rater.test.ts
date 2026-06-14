import { describe, it, expect } from 'vitest';
import { solveWithTechniques, rate } from '../../../../src/engine/puzzles/sudoku/rater';
import { gridFromString } from '../../../../src/engine/puzzles/sudoku/rules';

const SOLUTION =
  '534678912' + '672195348' + '198342567' +
  '859761423' + '426853791' + '713924856' +
  '961537284' + '287419635' + '345286179';
const EASY =
  '53..7....' + '6..195...' + '.98....6.' +
  '8...6...3' + '4..8.3..1' + '7...2...6' +
  '.6....28.' + '...419..5' + '....8..79';

describe('technique solver + rater', () => {
  it('solveWithTechniques solves an already-complete grid', () => {
    const t = solveWithTechniques(gridFromString(SOLUTION));
    expect(t.solved).toBe(true);
  });

  it('solveWithTechniques solves the classic easy puzzle', () => {
    const t = solveWithTechniques(gridFromString(EASY));
    expect(t.solved).toBe(true);
  });

  it('rate returns easy for the classic forced-single-solvable puzzle', () => {
    expect(rate({ givens: gridFromString(EASY) })).toBe('easy');
  });

  it('rate returns hard or expert for a near-empty grid (requires heavy search)', () => {
    const band = rate({ givens: gridFromString('1' + '0'.repeat(80)) });
    expect(['hard', 'expert']).toContain(band);
  });
});
