import type { YakusoInstance, YakusoState } from './types';
import type { Hint } from '../../core/types';
import { solveComplete } from './solver';

/**
 * Point the player at one interior cell that still needs action. The puzzle is uniquely
 * solvable, so every blank cell has a known value: a digit to place, or — for a cell whose
 * solution is `0` — a zero to cross out. Digit placements are offered first; a cross-out is
 * offered only once no digit remains, since the win check now requires every empty cell to be
 * explicitly crossed out, not just left blank. A cell the player has already filled OR crossed
 * out (any non-zero entry, including the play layer's MARKED_ZERO sentinel) is skipped. Never
 * returns a totals position. Returns null only when nothing is left to do.
 */
export function getHint(inst: YakusoInstance, state: YakusoState): Hint | null {
  const { solution } = solveComplete(inst, 1);
  if (!solution) return null;
  let crossOut = -1;
  for (let i = 0; i < solution.length; i++) {
    if (inst.clues[i] !== null) continue;      // already a given
    if (state.cells[i] !== 0) continue;        // already filled or already crossed out
    if (solution[i] === 0) {                    // a zero to cross out — remember as a fallback
      if (crossOut < 0) crossOut = i;
      continue;
    }
    return { cells: [i], text: `Place ${solution[i]}` };
  }
  return crossOut >= 0 ? { cells: [crossOut], text: 'Cross out' } : null;
}
