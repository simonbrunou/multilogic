import { allRuns } from '../../engine/puzzles/kakuro/rules';
import type { KakuroInstance } from '../../engine/puzzles/kakuro/types';
import type { PlayableGame } from './playable';

interface Snapshot {
  cells: number[];
  notes: number[][];
}

/** Pure, framework-free Kakuro play state with undo/redo. */
export class KakuroGame implements PlayableGame {
  readonly instance: KakuroInstance;
  readonly solution: number[];
  readonly width: number;
  readonly height: number;
  cells: number[];
  notes: Set<number>[];
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];

  constructor(instance: KakuroInstance, solution: number[]) {
    this.instance = instance;
    this.solution = solution;
    this.width = instance.width;
    this.height = instance.height;
    const n = instance.width * instance.height;
    // Black cells start at 0 and stay 0
    this.cells = new Array<number>(n).fill(0);
    this.notes = Array.from({ length: n }, () => new Set<number>());
  }

  private snapshot(): Snapshot {
    return { cells: [...this.cells], notes: this.notes.map((s) => [...s]) };
  }

  private restore(s: Snapshot): void {
    this.cells = [...s.cells];
    this.notes = s.notes.map((ds) => new Set(ds));
  }

  private commit(mutate: () => void): void {
    this.undoStack.push(this.snapshot());
    this.redoStack = [];
    mutate();
    if (this.undoStack.length > 100) this.undoStack.shift();
  }

  /** Black (wall/clue) cells are non-editable — treated as "givens". */
  isGiven(index: number): boolean {
    return this.instance.black[index];
  }

  input(index: number, value: number): boolean {
    if (this.isGiven(index)) return false;
    if (value !== 0 && (value < 1 || value > 9)) return false;
    this.commit(() => {
      this.cells[index] = value;
      this.notes[index].clear();
    });
    return true;
  }

  erase(index: number): boolean {
    if (this.isGiven(index)) return false;
    this.commit(() => {
      this.cells[index] = 0;
      this.notes[index].clear();
    });
    return true;
  }

  toggleNote(index: number, digit: number): boolean {
    if (this.isGiven(index) || this.cells[index] !== 0) return false;
    this.commit(() => {
      if (this.notes[index].has(digit)) this.notes[index].delete(digit);
      else this.notes[index].add(digit);
    });
    return true;
  }

  undo(): void {
    const s = this.undoStack.pop();
    if (!s) return;
    this.redoStack.push(this.snapshot());
    this.restore(s);
  }

  redo(): void {
    const s = this.redoStack.pop();
    if (!s) return;
    this.undoStack.push(this.snapshot());
    this.restore(s);
  }

  conflicts(): Set<number> {
    const bad = new Set<number>();
    const runs = allRuns(this.instance);

    for (const run of runs) {
      if (run.cells.length === 0) continue;

      const vals = run.cells.map((i) => this.cells[i]);
      const nonZero = vals.filter((v) => v !== 0);

      // Check for duplicate values within the run
      const seen = new Set<number>();
      for (let k = 0; k < vals.length; k++) {
        const v = vals[k];
        if (v === 0) continue;
        if (seen.has(v)) {
          // Mark all cells with this value in this run as conflicts
          for (let j = 0; j < vals.length; j++) {
            if (vals[j] === v) bad.add(run.cells[j]);
          }
        }
        seen.add(v);
      }

      // Check if run is complete and sum doesn't match clue
      const allFilled = vals.every((v) => v !== 0);
      if (allFilled && run.clueIndex >= 0) {
        const clue = this.instance.clues[run.clueIndex];
        if (clue) {
          const target = run.dir === 'h' ? clue.right : clue.down;
          if (target !== undefined) {
            const sum = nonZero.reduce((s, v) => s + v, 0);
            if (sum !== target) {
              for (const ci of run.cells) bad.add(ci);
            }
          }
        }
      }
    }

    return bad;
  }

  isSolved(): boolean {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.instance.black[i]) continue;
      if (this.cells[i] !== this.solution[i]) return false;
    }
    return true;
  }
}
