import { regionSizes, cellsByRegion, kingNeighbors } from '../../engine/puzzles/tectonic/rules';
import type { TectonicInstance } from '../../engine/puzzles/tectonic/types';
import type { PlayableGame } from './playable';

interface Snapshot {
  cells: number[];
  notes: number[][];
}

/** Pure, framework-free Tectonic play state with undo/redo. */
export class TectonicGame implements PlayableGame {
  readonly instance: TectonicInstance;
  readonly solution: number[];
  cells: number[];
  notes: Set<number>[];
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];

  constructor(instance: TectonicInstance, solution: number[]) {
    this.instance = instance;
    this.solution = solution;
    this.cells = [...instance.givens];
    const n = instance.width * instance.height;
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

  isGiven(index: number): boolean {
    return this.instance.givens[index] !== 0;
  }

  input(index: number, value: number): boolean {
    if (this.isGiven(index)) return false;
    const sizes = regionSizes(this.instance);
    const maxVal = sizes[this.instance.regions[index]];
    if (value !== 0 && (value < 1 || value > maxVal)) return false;
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
    const { width, height, regions } = this.instance;
    const byRegion = cellsByRegion(regions);
    for (let i = 0; i < this.cells.length; i++) {
      const v = this.cells[i];
      if (v === 0) continue;
      // king-move neighbours
      for (const k of kingNeighbors(i, width, height)) {
        if (this.cells[k] === v) { bad.add(i); bad.add(k); }
      }
      // same-region peers
      for (const p of byRegion[regions[i]]) {
        if (p !== i && this.cells[p] === v) { bad.add(i); bad.add(p); }
      }
    }
    return bad;
  }

  isSolved(): boolean {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] !== this.solution[i]) return false;
    }
    return true;
  }
}
