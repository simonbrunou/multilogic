/** A puzzle viewed for difficulty measurement: a flat grid of cells (0 = empty) and a
 *  per-cell candidate function honouring the puzzle's constraints. Deterministic (no PRNG). */
export interface EffortModel {
  cellCount: number;
  /** Valid values for EMPTY cell i given the current grid; ascending, deterministic. */
  candidates(grid: number[], i: number): number[];
}

/**
 * Minimal-guess difficulty: repeatedly fill forced (single-candidate) cells, then branch on the
 * fewest-candidate cell. Returns the number of guess attempts (branches tried, including ones that
 * backtrack) to reach a solution, or Infinity if unsolvable. 0 ⇒ solvable by forced cells alone.
 */
export function measureEffort(givens: number[], model: EffortModel): number {
  let guesses = 0;
  const solve = (grid: number[]): boolean => {
    const g = [...grid];
    // propagate forced singles
    for (;;) {
      let progressed = false;
      for (let i = 0; i < model.cellCount; i++) {
        if (g[i] !== 0) continue;
        const c = model.candidates(g, i);
        if (c.length === 0) return false;
        if (c.length === 1) { g[i] = c[0]; progressed = true; }
      }
      if (!progressed) break;
    }
    // pick the fewest-candidate empty cell (MRV)
    let target = -1;
    let best = Infinity;
    for (let i = 0; i < model.cellCount; i++) {
      if (g[i] !== 0) continue;
      const c = model.candidates(g, i);
      if (c.length < best) { best = c.length; target = i; }
    }
    if (target === -1) return true; // solved
    for (const v of model.candidates(g, target)) {
      guesses++;
      const g2 = [...g];
      g2[target] = v;
      if (solve(g2)) return true;
    }
    return false;
  };
  return solve(givens) ? guesses : Infinity;
}
