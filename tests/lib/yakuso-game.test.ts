import { describe, it, expect } from 'vitest';
import { YakusoGame, MARKED_ZERO, AUTO_ZERO } from '../../src/lib/play/yakuso-game';
import type { YakusoInstance } from '../../src/engine/puzzles/yakuso/types';
import { generateForDifficulty } from '../../src/engine/puzzles/yakuso/generator';
import { createPrng } from '../../src/engine/core/prng';

function mkGame(seed: string, d: 'easy' | 'medium' | 'hard' | 'expert' = 'easy') {
  const g = generateForDifficulty(createPrng(seed), d);
  return { game: new YakusoGame(g.instance, g.solution), gen: g };
}

/** A blank board with no clues, for deterministic input-behaviour tests. */
function blankGame(rows = 3) {
  const cols = rows + 1;
  const n = rows * cols;
  const instance: YakusoInstance = {
    rows,
    cols,
    totals: new Array(cols).fill(0),
    clues: new Array(n).fill(null)
  };
  return new YakusoGame(instance, new Array(n).fill(0));
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
    // An editable cell: unseeded and not auto-locked (a row already complete from givens
    // auto-fills and locks its blanks at construction).
    const freeIdx = gen.instance.clues.findIndex((c, i) => c === null && !game.isLocked(i));
    expect(freeIdx).toBeGreaterThanOrEqual(0);
    expect(game.input(givenIdx, 1)).toBe(false);
    expect(game.input(freeIdx, gen.instance.rows + 1)).toBe(false); // > R disallowed
    expect(game.input(freeIdx, gen.instance.rows)).toBe(true);
    expect(game.erase(freeIdx)).toBe(true);
    expect(game.cells[freeIdx]).toBe(0);
  });

  it('flags a row holding two different digits as a conflict', () => {
    const g = blankGame(); // 3×4
    g.input(0, 2); // (0,0)=2 — row owns 2, needs two of them, so not yet complete
    g.input(1, 3); // (0,1)=3 — two distinct digits in one row
    const conf = g.conflicts();
    expect(conf.has(0)).toBe(true);
    expect(conf.has(1)).toBe(true);
  });

  it('auto-fills the rest of a row with locked zeros once it is completed', () => {
    const g = blankGame(); // 3×4
    g.input(0, 2); // one 2 of the row-owns-2 pair
    expect(g.cells[2]).toBe(0); // nothing auto-filled yet
    g.input(1, 2); // second 2 completes the row
    expect(g.cells[2]).toBe(AUTO_ZERO);
    expect(g.cells[3]).toBe(AUTO_ZERO);
    expect(g.isLocked(2)).toBe(true);
    expect(g.input(2, 1)).toBe(false); // auto-filled zeros are read-only
    expect(g.erase(2)).toBe(false);
  });

  it('clears auto-filled zeros (but keeps hand-placed ones) when a row is broken', () => {
    const g = blankGame(); // 3×4
    g.input(3, 0); // (0,3) hand-committed zero (MARKED_ZERO)
    g.input(0, 2);
    g.input(1, 2); // completes the row → (0,2) auto-fills
    expect(g.cells[2]).toBe(AUTO_ZERO);
    expect(g.cells[3]).toBe(MARKED_ZERO);
    g.erase(0); // remove one 2 → row no longer complete
    expect(g.cells[2]).toBe(0); // auto-filled zero cleared
    expect(g.cells[3]).toBe(MARKED_ZERO); // hand-placed zero preserved
  });

  it('treats a digit placement and its auto-fill as one undo step', () => {
    const g = blankGame(); // 3×4
    g.input(0, 2);
    g.input(1, 2); // completes the row and auto-fills (0,2)/(0,3)
    expect(g.cells[2]).toBe(AUTO_ZERO);
    g.undo();
    expect(g.cells[1]).toBe(0); // the completing 2 is gone…
    expect(g.cells[2]).toBe(0); // …and so is the auto-filled zero
  });

  it('auto-crosses empty cells as rows complete, finishing the board', () => {
    const { game, gen } = mkGame('yg-zero');
    const zeroIdx = gen.solution.findIndex((v, i) => v === 0 && gen.instance.clues[i] === null);
    expect(zeroIdx).toBeGreaterThanOrEqual(0); // sanity: yakuso solutions are sparse
    // Place only the non-zero solution digits; the empty cells are never touched by hand.
    for (let i = 0; i < gen.solution.length; i++) {
      if (gen.instance.clues[i] === null && gen.solution[i] > 0) game.input(i, gen.solution[i]);
    }
    expect(game.cells[zeroIdx]).toBe(AUTO_ZERO); // completing the rows crossed it out for us
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
