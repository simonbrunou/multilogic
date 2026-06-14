import { describe, it, expect } from 'vitest';
import { horizontalRuns, verticalRuns, deriveClues, serializeInstance, deserializeInstance } from '../../../../src/engine/puzzles/kakuro/rules';
import type { KakuroInstance } from '../../../../src/engine/puzzles/kakuro/types';

// 3x3: row0 & col0 black; interior 2x2 all white (cells 4,5,7,8).
//  B B B
//  B . .
//  B . .
const black = [true, true, true, true, false, false, true, false, false];
const inst: KakuroInstance = { width: 3, height: 3, black, clues: black.map((b) => (b ? {} : null)) };

describe('kakuro rules', () => {
  it('horizontalRuns finds white runs with the left clue cell', () => {
    const hr = horizontalRuns(3, 3, black);
    // rows 1 and 2 each have a 2-cell white run (cells 4,5 clue 3) and (7,8 clue 6)
    const runs = hr.filter((r) => r.cells.length > 0);
    expect(runs).toContainEqual({ cells: [4, 5], clueIndex: 3, dir: 'h' });
    expect(runs).toContainEqual({ cells: [7, 8], clueIndex: 6, dir: 'h' });
  });
  it('verticalRuns finds white runs with the top clue cell', () => {
    const vr = verticalRuns(3, 3, black).filter((r) => r.cells.length > 0);
    expect(vr).toContainEqual({ cells: [4, 7], clueIndex: 1, dir: 'v' });
    expect(vr).toContainEqual({ cells: [5, 8], clueIndex: 2, dir: 'v' });
  });
  it('deriveClues sums runs onto the heading black cells', () => {
    const sol = [0, 0, 0, 0, 1, 2, 0, 3, 4]; // white cells 4=1,5=2,7=3,8=4
    const clues = deriveClues(inst, sol);
    expect(clues[3]).toEqual({ right: 3 });   // run [4,5] = 1+2
    expect(clues[6]).toEqual({ right: 7 });   // run [7,8] = 3+4
    expect(clues[1]).toEqual({ down: 4 });    // run [4,7] = 1+3
    expect(clues[2]).toEqual({ down: 6 });    // run [5,8] = 2+4
  });
  it('serialize/deserialize round-trips', () => {
    expect(deserializeInstance(serializeInstance(inst))).toEqual(inst);
  });
});
