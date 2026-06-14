import { SudokuGame } from './game-core';
import { gridFromString } from '../engine/puzzles/sudoku/rules';
import { getHint } from '../engine/puzzles/sudoku/hint';

export class GameStore {
  game = $state<SudokuGame | null>(null);
  selected = $state<number | null>(null);
  noteMode = $state(false);
  elapsedMs = $state(0);
  hintsUsed = $state(0);
  /** Incremented after each mutation to force derived re-reads. */
  tick = $state(0);
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;

  load(givens: string, solution: string, cells?: number[], notes?: [number, number[]][], elapsedMs = 0): void {
    this.game = new SudokuGame(gridFromString(givens), gridFromString(solution), cells, notes);
    this.elapsedMs = elapsedMs;
    this.hintsUsed = 0;
    this.tick = 0;
    this.startTimer();
  }

  private startTimer(): void {
    this.stopTimer();
    this.startedAt = Date.now() - this.elapsedMs;
    this.timer = setInterval(() => { this.elapsedMs = Date.now() - this.startedAt; }, 250);
  }

  stopTimer(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private bump(): void { this.tick += 1; }

  enter(value: number): void {
    if (!this.game || this.selected === null) return;
    if (this.noteMode) this.game.toggleNote(this.selected, value);
    else this.game.input(this.selected, value);
    if (this.game.isSolved()) this.stopTimer();
    this.bump();
  }

  erase(): void {
    if (!this.game || this.selected === null) return;
    this.game.erase(this.selected);
    this.bump();
  }

  undo(): void { this.game?.undo(); this.bump(); }
  redo(): void { this.game?.redo(); this.bump(); }

  hint(): void {
    if (!this.game) return;
    const h = getHint({ givens: this.game.givens }, { cells: this.game.cells });
    if (h && h.cells.length) { this.selected = h.cells[0]; this.hintsUsed += 1; }
  }
}
