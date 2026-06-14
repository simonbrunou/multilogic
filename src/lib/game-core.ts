import { PEERS } from '../engine/puzzles/sudoku/candidates';
import { UndoableGame } from './play/base-game';

/** Pure, framework-free Sudoku play state with undo/redo. */
export class SudokuGame extends UndoableGame {
  readonly givens: number[];
  readonly solution: number[];

  constructor(givens: number[], solution: number[], initialCells?: number[], initialNotes?: [number, number[]][]) {
    super(initialCells ? [...initialCells] : [...givens], 81);
    this.givens = givens;
    this.solution = solution;
    if (initialNotes) for (const [i, ds] of initialNotes) this.notes[i] = new Set(ds);
  }

  isGiven(index: number): boolean {
    return this.givens[index] !== 0;
  }

  conflicts(): Set<number> {
    const bad = new Set<number>();
    for (let i = 0; i < 81; i++) {
      const v = this.cells[i];
      if (v === 0) continue;
      for (const p of PEERS[i]) {
        if (this.cells[p] === v) { bad.add(i); bad.add(p); }
      }
    }
    return bad;
  }

  isSolved(): boolean {
    for (let i = 0; i < 81; i++) if (this.cells[i] !== this.solution[i]) return false;
    return true;
  }
}
