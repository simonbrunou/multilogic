import { describe, it, expect } from 'vitest';
import { solveWithTechniques, rate } from '../../../../src/engine/puzzles/sudoku/rater';
import { gridFromString } from '../../../../src/engine/puzzles/sudoku/rules';
import { solveComplete } from '../../../../src/engine/puzzles/sudoku/solver';

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
    expect(solveWithTechniques(gridFromString(SOLUTION)).solved).toBe(true);
  });

  it('solveWithTechniques solves the classic easy puzzle and never contradicts the unique solution', () => {
    const trace = solveWithTechniques(gridFromString(EASY));
    expect(trace.solved).toBe(true);
    const unique = solveComplete({ givens: gridFromString(EASY) }, 2);
    expect(unique.count).toBe(1);
  });

  it('rate returns easy for a singles-only puzzle', () => {
    expect(rate({ givens: gridFromString(EASY) })).toBe('easy');
  });

  it('rate returns expert for a grid the ladder cannot crack', () => {
    expect(rate({ givens: gridFromString('1' + '0'.repeat(80)) })).toBe('expert');
  });
});
