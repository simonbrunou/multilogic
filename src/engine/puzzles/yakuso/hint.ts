import type { YakusoInstance, YakusoState } from './types';
import type { Hint } from '../../core/types';
import { solveComplete } from './solver';

/**
 * Point the player at one interior cell that still needs a digit. The puzzle is
 * uniquely solvable, so the first currently-blank, non-seeded cell whose solution
 * value is non-zero is a safe place to work next. Never returns a totals position
 * (the totals row is not part of the cell space). Returns null if nothing remains.
 */
export function getHint(inst: YakusoInstance, state: YakusoState): Hint | null {
  const { solution } = solveComplete(inst, 1);
  if (!solution) return null;
  for (let i = 0; i < solution.length; i++) {
    if (inst.clues[i] !== null) continue;      // already a given
    if (state.cells[i] !== 0) continue;        // player already filled it
    if (solution[i] === 0) continue;           // a blank cell — no action needed
    return { cells: [i], text: `Place ${solution[i]}` };
  }
  return null;
}
