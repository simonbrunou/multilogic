import { describe, it, expect } from 'vitest';
import { YakusoGame, MARKED_ZERO } from '../../src/lib/play/yakuso-game';
import { generateForDifficulty } from '../../src/engine/puzzles/yakuso/generator';
import { createPrng } from '../../src/engine/core/prng';

function mkGame(seed: string, d: 'easy' | 'medium' | 'hard' | 'expert' = 'easy') {
  const g = generateForDifficulty(createPrng(seed), d);
  return { game: new YakusoGame(g.instance, g.solution), gen: g };
}

describe('YakusoGame', () => {
  it('seeds the board from clues and marks givens fixed', () => {
    const { game, gen } = mkGame('yg-1');
    gen.instance.clues.forEach((c, i) => {
      expect(game.isGiven(i)).toBe(c !== null);
      if (c !== null) expect(game.cells[i]).toBe(c);
    });
  });

  it('blocks input on given cells and rejects out-of-range values', () => {
    const { game, gen } = mkGame('yg-2');
    const givenIdx = gen.instance.clues.findIndex((c) => c !== null);
    const freeIdx = gen.instance.clues.findIndex((c) => c === null);
    expect(game.input(givenIdx, 1)).toBe(false);
    expect(game.input(freeIdx, gen.instance.rows + 1)).toBe(false); // > R disallowed
    expect(game.input(freeIdx, gen.instance.rows)).toBe(true);
    expect(game.erase(freeIdx)).toBe(true);
    expect(game.cells[freeIdx]).toBe(0);
  });

  it('flags a row holding two different digits as a conflict', () => {
    const { game, gen } = mkGame('yg-3');
    const cols = gen.instance.cols;
    // find two free cells in the same row
    let a = -1, b = -1;
    for (let r = 0; r < gen.instance.rows && a < 0; r++) {
      const free = [];
      for (let c = 0; c < cols; c++) { const i = r * cols + c; if (gen.instance.clues[i] === null) free.push(i); }
      if (free.length >= 2) { a = free[0]; b = free[1]; }
    }
    expect(a).toBeGreaterThanOrEqual(0);
    game.input(a, 1);
    game.input(b, 2); // two distinct digits in one row
    const conf = game.conflicts();
    expect(conf.has(a)).toBe(true);
    expect(conf.has(b)).toBe(true);
  });

  it('is not finished until every empty (0) cell is explicitly crossed out', () => {
    const { game, gen } = mkGame('yg-zero');
    // A non-given cell whose solution is an empty 0 — the player must commit it, not leave it blank.
    const zeroIdx = gen.solution.findIndex((v, i) => v === 0 && gen.instance.clues[i] === null);
    expect(zeroIdx).toBeGreaterThanOrEqual(0); // sanity: yakuso solutions are sparse
    // Place every other non-given cell at its solution value, leaving zeroIdx untouched.
    for (let i = 0; i < gen.solution.length; i++) {
      if (gen.instance.clues[i] === null && i !== zeroIdx) game.input(i, gen.solution[i]);
    }
    expect(game.isSolved()).toBe(false); // blank 0 doesn't count as a placed 0
    game.input(zeroIdx, 0); // cross it out (MARKED_ZERO)
    expect(game.isSolved()).toBe(true);
  });

  it('restore round-trips committed zeros (MARKED_ZERO) for resuming a saved board', () => {
    const { game, gen } = mkGame('yg-restore');
    const zeroIdx = gen.solution.findIndex((v, i) => v === 0 && gen.instance.clues[i] === null);
    const digitIdx = gen.solution.findIndex((v, i) => v > 0 && gen.instance.clues[i] === null);
    game.input(zeroIdx, 0); // crossed-out zero → MARKED_ZERO (-1)
    game.input(digitIdx, gen.solution[digitIdx]);
    expect(game.cells[zeroIdx]).toBe(MARKED_ZERO);
    // Simulate save → resume: a fresh game restored from the serialized cells.
    const saved = [...game.cells];
    const resumed = new YakusoGame(gen.instance, gen.solution);
    resumed.restore(saved, []);
    expect(resumed.cells[zeroIdx]).toBe(MARKED_ZERO); // the -1 sentinel survives the round-trip
    expect(resumed.cells[digitIdx]).toBe(gen.solution[digitIdx]);
  });

  it('isSolved is true exactly at the full solution and supports undo', () => {
    const { game, gen } = mkGame('yg-4');
    expect(game.isSolved()).toBe(false);
    for (let i = 0; i < gen.solution.length; i++) if (gen.instance.clues[i] === null) game.input(i, gen.solution[i]);
    expect(game.isSolved()).toBe(true);
    game.undo();
    expect(game.isSolved()).toBe(false);
    game.redo();
    expect(game.isSolved()).toBe(true);
  });
});
