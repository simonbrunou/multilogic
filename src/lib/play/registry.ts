import type { Component } from 'svelte';
import type { PuzzleType } from '../../engine/core/types';
import { getModule } from '../../engine/puzzles/registry';
import { SudokuGame } from '../game-core';
import { TectonicGame } from './tectonic-game';
import type { PlayableGame } from './playable';
import SudokuGrid from '../components/SudokuGrid.svelte';
import TectonicGrid from '../components/TectonicGrid.svelte';
import { regionSizes } from '../../engine/puzzles/tectonic/rules';

export interface PlayUiEntry {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Grid: Component<any>;
  makeGame(instanceStr: string, solutionStr: string): PlayableGame;
  hintProvider(instanceStr: string): (cells: number[]) => number | null;
  maxDigit(instanceStr: string): number;
}

export const PLAY_UI: Partial<Record<PuzzleType, PlayUiEntry>> = {
  sudoku: {
    label: 'Sudoku',
    Grid: SudokuGrid,
    makeGame: (i, s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = (getModule('sudoku') as any).deserializeInstance(i);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sol = (getModule('sudoku') as any).deserializeSolution(s);
      return new SudokuGame(inst.givens, sol);
    },
    hintProvider: (i) => (cells) => {
      const mod = getModule('sudoku');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = (mod as any).deserializeInstance(i);
      const h = mod.getHint?.(inst, { cells } as never);
      return h && h.cells.length ? h.cells[0] : null;
    },
    maxDigit: () => 9
  },
  tectonic: {
    label: 'Tectonic',
    Grid: TectonicGrid,
    makeGame: (i, s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = (getModule('tectonic') as any).deserializeInstance(i);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sol = (getModule('tectonic') as any).deserializeSolution(s);
      return new TectonicGame(inst, sol);
    },
    hintProvider: (i) => (cells) => {
      const mod = getModule('tectonic');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = (mod as any).deserializeInstance(i);
      const h = mod.getHint?.(inst, { cells } as never);
      return h && h.cells.length ? h.cells[0] : null;
    },
    maxDigit: (i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inst = (getModule('tectonic') as any).deserializeInstance(i);
      const sizes = regionSizes(inst);
      return Math.max(...Object.values(sizes));
    }
  }
};
