import type { YakusoInstance } from '../../engine/puzzles/yakuso/types';
import { UndoableGame } from './base-game';

/**
 * Sentinel stored in `cells` for a cell the player has *committed* to `0`
 * (a visible, crossed-out empty), as distinct from an untouched blank (`0`).
 * For every rule it normalizes to `0`; it exists only to drive the display.
 */
export const MARKED_ZERO = -1;

/**
 * Pure, framework-free YAKUSO play state with undo/redo.
 *
 * The interactive board is the `rows*cols` interior grid (`0` = empty). The
 * totals row is not part of the cell array — it is shown read-only by the grid
 * from `instance.totals`, so it can never be edited or hinted.
 */
export class YakusoGame extends UndoableGame {
  readonly instance: YakusoInstance;
  readonly solution: number[];

  constructor(instance: YakusoInstance, solution: number[]) {
    const n = instance.rows * instance.cols;
    super(instance.clues.map((c) => c ?? 0), n);
    this.instance = instance;
    this.solution = solution;
  }

  /** Seeded clue cells are fixed. */
  isGiven(index: number): boolean {
    return this.instance.clues[index] !== null;
  }

  /** The digit at `i` for rule purposes: a committed zero counts as empty. */
  private digit(index: number): number {
    const v = this.cells[index];
    return v === MARKED_ZERO ? 0 : v;
  }

  protected allows(_index: number, value: number): boolean {
    return value === MARKED_ZERO || value === 0 || (value >= 1 && value <= this.instance.rows);
  }

  /** Entering `0` commits a visible zero; `1..R` place that digit. (Erase clears to blank.) */
  input(index: number, value: number): boolean {
    return super.input(index, value === 0 ? MARKED_ZERO : value);
  }

  /** Notes only ever hold real digits `1..R`. */
  toggleNote(index: number, digit: number): boolean {
    if (digit < 1 || digit > this.instance.rows) return false;
    return super.toggleNote(index, digit);
  }

  /** Indices of the filled cells in row `r`, grouped by their value. */
  private rowByDigit(r: number): Map<number, number[]> {
    const { cols } = this.instance;
    const byDigit = new Map<number, number[]>();
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const v = this.digit(i);
      if (v === 0) continue;
      (byDigit.get(v) ?? byDigit.set(v, []).get(v)!).push(i);
    }
    return byDigit;
  }

  /** Mark one row's violations (mixed digits, or a digit placed more than `d` times); return its sole digit (0 if none/mixed). */
  private markRow(byDigit: Map<number, number[]>, bad: Set<number>): number {
    if (byDigit.size > 1) {
      for (const list of byDigit.values()) for (const i of list) bad.add(i);
      return 0;
    }
    for (const [d, list] of byDigit) if (list.length > d) for (const i of list) bad.add(i);
    return byDigit.size === 1 ? [...byDigit.keys()][0] : 0;
  }

  /** Per row: at most one digit, placed at most `d` times. Returns each row's sole digit (0 if none/mixed). */
  private rowConflicts(bad: Set<number>): number[] {
    const { rows } = this.instance;
    const rowDigit = new Array<number>(rows).fill(0);
    for (let r = 0; r < rows; r++) rowDigit[r] = this.markRow(this.rowByDigit(r), bad);
    return rowDigit;
  }

  /** Across rows: a digit may own at most one row. */
  private crossRowConflicts(rowDigit: number[], bad: Set<number>): void {
    const { rows, cols } = this.instance;
    const digitRows = new Map<number, number[]>();
    for (let r = 0; r < rows; r++) {
      if (rowDigit[r] === 0) continue;
      (digitRows.get(rowDigit[r]) ?? digitRows.set(rowDigit[r], []).get(rowDigit[r])!).push(r);
    }
    for (const list of digitRows.values()) {
      if (list.length < 2) continue;
      for (const r of list) for (let c = 0; c < cols; c++) if (this.digit(r * cols + c) !== 0) bad.add(r * cols + c);
    }
  }

  /** Per column: the filled sum must not exceed the displayed total. */
  private columnConflicts(bad: Set<number>): void {
    const { rows, cols, totals } = this.instance;
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      const filled: number[] = [];
      for (let r = 0; r < rows; r++) {
        const i = r * cols + c;
        const v = this.digit(i);
        if (v !== 0) { sum += v; filled.push(i); }
      }
      if (sum > totals[c]) for (const i of filled) bad.add(i);
    }
  }

  conflicts(): Set<number> {
    const bad = new Set<number>();
    const rowDigit = this.rowConflicts(bad);
    this.crossRowConflicts(rowDigit, bad);
    this.columnConflicts(bad);
    return bad;
  }

  isSolved(): boolean {
    for (let i = 0; i < this.cells.length; i++) {
      // Every interactive cell must be explicitly placed before the board counts as
      // finished — an untouched blank (still 0, never a committed MARKED_ZERO) is not a
      // placed 0, even where the solution is 0. Givens are already placed.
      if (!this.isGiven(i) && this.cells[i] === 0) return false;
      if (this.digit(i) !== this.solution[i]) return false;
    }
    return true;
  }
}
