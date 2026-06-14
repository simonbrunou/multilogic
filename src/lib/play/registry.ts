import type { Component } from 'svelte';
import type { PuzzleType } from '../../engine/core/types';
import { getModule } from '../../engine/puzzles/registry';
import { SudokuGame } from '../game-core';
import { TectonicGame } from './tectonic-game';
import { KakuroGame } from './kakuro-game';
import type { PlayableGame } from './playable';
import SudokuGrid from '../components/SudokuGrid.svelte';
import TectonicGrid from '../components/TectonicGrid.svelte';
import KakuroGrid from '../components/KakuroGrid.svelte';
import { regionSizes } from '../../engine/puzzles/tectonic/rules';

export interface PlayUiEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Grid: Component<any>;
  makeGame(instanceStr: string, solutionStr: string): PlayableGame;
  hintProvider(instanceStr: string): (cells: number[]) => number | null;
  maxDigit(instanceStr: string): number;
}

/** Standard single-cell hint provider: deserialize, ask the module for a hint, return its first cell. */
function makeHintProvider(type: PuzzleType): (instanceStr: string) => (cells: number[]) => number | null {
  return (instanceStr) => (cells) => {
    const mod = getModule(type);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inst = (mod as any).deserializeInstance(instanceStr);
    const h = mod.getHint?.(inst, { cells } as never);
    return h && h.cells.length ? h.cells[0] : null;
  };
}

export const PLAY_UI: Partial<Record<PuzzleType, PlayUiEntry>> = {
  sudoku: {
    Grid: SudokuGrid,
    makeGame: (i, s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = (getModule('sudoku') as any).deserializeInstance(i);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sol = (getModule('sudoku') as any).deserializeSolution(s);
      return new SudokuGame(inst.givens, sol);
    },
    hintProvider: makeHintProvider('sudoku'),
    maxDigit: () => 9
  },
  tectonic: {
    Grid: TectonicGrid,
    makeGame: (i, s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = (getModule('tectonic') as any).deserializeInstance(i);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sol = (getModule('tectonic') as any).deserializeSolution(s);
      return new TectonicGame(inst, sol);
    },
    hintProvider: makeHintProvider('tectonic'),
    maxDigit: (i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = (getModule('tectonic') as any).deserializeInstance(i);
      const sizes = regionSizes(inst);
      return Math.max(...Object.values(sizes));
    }
  },
  kakuro: {
    Grid: KakuroGrid,
    makeGame: (i, s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = (getModule('kakuro') as any).deserializeInstance(i);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sol = (getModule('kakuro') as any).deserializeSolution(s);
      return new KakuroGame(inst, sol);
    },
    hintProvider: makeHintProvider('kakuro'),
    maxDigit: () => 9
  }
};
