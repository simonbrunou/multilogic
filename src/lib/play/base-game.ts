import type { PlayableGame } from './playable';

interface Snapshot {
  cells: number[];
  notes: number[][];
}

/**
 * Shared, framework-free play-state scaffold for the puzzle variants.
 *
 * Holds cell/notes storage plus undo/redo, and templates the common
 * input/erase/note edits. Subclasses supply the puzzle-specific rules:
 * which cells are fixed (`isGiven`), which values are accepted (`allows`),
 * conflict detection (`conflicts`), and the win check (`isSolved`).
 */
export abstract class UndoableGame implements PlayableGame {
  cells: number[];
  notes: Set<number>[];
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];

  protected constructor(cells: number[], cellCount: number) {
    this.cells = cells;
    this.notes = Array.from({ length: cellCount }, () => new Set<number>());
  }

  private snapshot(): Snapshot {
    return { cells: [...this.cells], notes: this.notes.map((s) => [...s]) };
  }

  private restore(s: Snapshot): void {
    this.cells = [...s.cells];
    this.notes = s.notes.map((ds) => new Set(ds));
  }

  protected commit(mutate: () => void): void {
    this.undoStack.push(this.snapshot());
    this.redoStack = [];
    mutate();
    if (this.undoStack.length > 100) this.undoStack.shift();
  }

  abstract isGiven(index: number): boolean;
  abstract conflicts(): Set<number>;
  abstract isSolved(): boolean;

  /** Whether `value` (0 = empty) may be placed at `index`. Override to add range rules. */
  protected allows(_index: number, _value: number): boolean {
    return true;
  }

  input(index: number, value: number): boolean {
    if (this.isGiven(index) || !this.allows(index, value)) return false;
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
}
