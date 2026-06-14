import { allRuns, type Run } from '../../engine/puzzles/kakuro/rules';
import type { KakuroInstance } from '../../engine/puzzles/kakuro/types';
import { UndoableGame } from './base-game';

/** Pure, framework-free Kakuro play state with undo/redo. */
export class KakuroGame extends UndoableGame {
  readonly instance: KakuroInstance;
  readonly solution: number[];
  readonly width: number;
  readonly height: number;

  constructor(instance: KakuroInstance, solution: number[]) {
    const n = instance.width * instance.height;
    // Black cells start at 0 and stay 0.
    super(new Array<number>(n).fill(0), n);
    this.instance = instance;
    this.solution = solution;
    this.width = instance.width;
    this.height = instance.height;
  }

  /** Black (wall/clue) cells are non-editable — treated as "givens". */
  isGiven(index: number): boolean {
    return this.instance.black[index];
  }

  protected allows(_index: number, value: number): boolean {
    return value === 0 || (value >= 1 && value <= 9);
  }

  /** Cells in a single run that violate uniqueness or (when full) the clue sum. */
  private runConflicts(run: Run): number[] {
    const vals = run.cells.map((i) => this.cells[i]);
    const bad: number[] = [];

    // Duplicate values within the run.
    const byValue = new Map<number, number[]>();
    vals.forEach((v, j) => {
      if (v === 0) return;
      const cells = byValue.get(v) ?? [];
      cells.push(run.cells[j]);
      byValue.set(v, cells);
    });
    for (const cells of byValue.values()) if (cells.length > 1) bad.push(...cells);

    // A completed run whose sum misses its clue.
    if (run.clueIndex >= 0 && vals.every((v) => v !== 0)) {
      const clue = this.instance.clues[run.clueIndex];
      const target = clue && (run.dir === 'h' ? clue.right : clue.down);
      if (target !== undefined && vals.reduce((s, v) => s + v, 0) !== target) {
        bad.push(...run.cells);
      }
    }

    return bad;
  }

  conflicts(): Set<number> {
    const bad = new Set<number>();
    for (const run of allRuns(this.instance)) {
      if (run.cells.length === 0) continue;
      for (const ci of this.runConflicts(run)) bad.add(ci);
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
