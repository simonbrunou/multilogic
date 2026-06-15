import type { PuzzleModule, PuzzleType } from '../core/types';
import { sudoku } from './sudoku/index';
import { tectonic } from './tectonic/index';
import { kakuro } from './kakuro/index';
import { grecolatin } from './grecolatin/index';
import { yakuso } from './yakuso/index';

export const MODULES: Record<PuzzleType, PuzzleModule | undefined> = {
  sudoku,
  tectonic,
  kakuro,
  grecolatin,
  yakuso,
};

export function getModule(type: PuzzleType): PuzzleModule {
  const m = MODULES[type];
  if (!m) throw new Error(`no module for puzzle type: ${type}`);
  return m;
}
