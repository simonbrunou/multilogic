import { PEERS } from '../engine/puzzles/sudoku/candidates';

interface Snapshot {
  cells: number[];
  notes: number[][];
}

/** Pure, framework-free Sudoku play state with undo/redo. */
export class SudokuGame {
  readonly givens: number[];
  readonly solution: number[];
  cells: number[];
  notes: Set<number>[];
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];

  constructor(givens: number[], solution: number[], initialCells?: number[], initialNotes?: [number, number[]][]) {
    this.givens = givens;
    this.solution = solution;
    this.cells = initialCells ? [...initialCells] : [...givens];
    this.notes = Array.from({ length: 81 }, () => new Set<number>());
    if (initialNotes) for (const [i, ds] of initialNotes) this.notes[i] = new Set(ds);
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

  isGiven(index: number): boolean {
    return this.givens[index] !== 0;
  }

  input(index: number, value: number): boolean {
    if (this.isGiven(index)) return false;
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

  notesForSave(): [number, number[]][] {
    const out: [number, number[]][] = [];
    this.notes.forEach((s, i) => { if (s.size) out.push([i, [...s]]); });
    return out;
  }
}
