import { regionSizes, cellsByRegion, kingNeighbors } from '../../engine/puzzles/tectonic/rules';
import type { TectonicInstance } from '../../engine/puzzles/tectonic/types';
import { UndoableGame } from './base-game';

/** Pure, framework-free Tectonic play state with undo/redo. */
export class TectonicGame extends UndoableGame {
  readonly instance: TectonicInstance;
  readonly solution: number[];

  constructor(instance: TectonicInstance, solution: number[]) {
    super([...instance.givens], instance.width * instance.height);
    this.instance = instance;
    this.solution = solution;
  }

  isGiven(index: number): boolean {
    return this.instance.givens[index] !== 0;
  }

  protected allows(index: number, value: number): boolean {
    const maxVal = regionSizes(this.instance)[this.instance.regions[index]];
    return value === 0 || (value >= 1 && value <= maxVal);
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
