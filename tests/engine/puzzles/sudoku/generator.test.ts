import { describe, it, expect } from 'vitest';
import { generateForDifficulty } from '../../../../src/engine/puzzles/sudoku/generator';
import { rate } from '../../../../src/engine/puzzles/sudoku/rater';
import { solveComplete } from '../../../../src/engine/puzzles/sudoku/solver';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import { DIFFICULTIES, type Difficulty } from '../../../../src/engine/core/types';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

describe('sudoku generateForDifficulty (dig-to-minimal + relax)', () => {
  it('never overshoots the target band and stays uniquely solvable', () => {
    for (const target of DIFFICULTIES) {
      for (let s = 0; s < 6; s++) {
        const g = generateForDifficulty(createPrng(deriveSeed('sudoku', target, 'overshoot', s)), target);
        expect(RANK[g.difficulty]).toBeLessThanOrEqual(RANK[target]);
        expect(g.difficulty).toBe(rate({ givens: g.givens }));
        expect(solveComplete({ givens: g.givens }, 2).count).toBe(1);
      }
    }
  });

  it('reaches every target band within a small seed batch', () => {
    for (const target of DIFFICULTIES) {
      let hit = false;
      for (let s = 0; s < 24 && !hit; s++) {
        if (generateForDifficulty(createPrng(deriveSeed('sudoku', target, 'reach', s)), target).difficulty === target) {
          hit = true;
        }
      }
      expect(hit, `target ${target} should be reachable within 24 seeds`).toBe(true);
    }
  });

  it('a generated solution is a complete valid grid', () => {
    const g = generateForDifficulty(createPrng(deriveSeed('sudoku', 'hard', 'sol', 0)), 'hard');
    expect(g.solution.every((v) => v >= 1 && v <= 9)).toBe(true);
    expect(g.solution.length).toBe(81);
  });
});
