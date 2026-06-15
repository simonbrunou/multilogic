import { computeCandidates } from './candidates';
import { nakedSingle, hiddenSingle, lockedCandidates, nakedPair, type TechniqueName } from './techniques';
import type { SudokuInstance, SudokuState } from './types';
import type { Hint } from '../../core/types';

const ORDER = [nakedSingle, hiddenSingle, lockedCandidates, nakedPair];
const LABEL: Record<TechniqueName, string> = {
  nakedSingle: 'Naked single',
  hiddenSingle: 'Hidden single',
  lockedCandidates: 'Locked candidates',
  nakedPair: 'Naked pair',
  hiddenPair: 'Hidden pair',
  nakedTriple: 'Naked triple',
  hiddenTriple: 'Hidden triple',
  xWing: 'X-wing'
};

/**
 * Suggest the next logical step given the current play state.
 * Working grid = givens overlaid with the player's entries.
 * Returns null when no technique applies — including when the player's entries make the
 * grid contradictory (no technique can fire), so the UI should flag conflicts separately.
 */
export function getHint(instance: SudokuInstance, state: SudokuState): Hint | null {
  const grid = instance.givens.map((g, i) => (g !== 0 ? g : state.cells[i] || 0));
  const cand = computeCandidates(grid);
  for (const fn of ORDER) {
    const step = fn(grid, cand);
    if (!step) continue;
    if (step.placements.length) {
      const p = step.placements[0];
      return { cells: [p.index], text: `${LABEL[step.technique]}: place ${p.digit}` };
    }
    return {
      cells: step.eliminations.map((e) => e.index),
      text: `${LABEL[step.technique]}: removes candidates`
    };
  }
  return null;
}
