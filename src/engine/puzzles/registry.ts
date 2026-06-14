import type { PuzzleModule, PuzzleType } from '../core/types';
import { sudoku } from './sudoku/index';
import { tectonic } from './tectonic/index';

export const MODULES: Record<PuzzleType, PuzzleModule | undefined> = {
  sudoku,
  tectonic,
  kakuro: undefined,
  grecolatin: undefined
};

export function getModule(type: PuzzleType): PuzzleModule {
  const m = MODULES[type];
  if (!m) throw new Error(`no module for puzzle type: ${type}`);
  return m;
}
