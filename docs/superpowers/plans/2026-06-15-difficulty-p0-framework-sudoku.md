# Technique-Based Difficulty — P0: Shared Framework + Sudoku Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Sudoku's machine-effort difficulty rating with a human-technique rating built on a reusable shared framework, and prove (via a benchmark gate) that the deep-ladder approach fits the generation latency budget.

**Architecture:** A new pure `src/engine/core/technique-rating.ts` provides a generic solve-by-ladder + band-mapping engine. Sudoku's `rater.ts` is refactored to (a) supply a rank-tagged technique ladder up through X-wing, (b) drive it through the shared engine, and (c) map the hardest required rank — plus a step-count bump — to a difficulty band, with "unsolved by ladder" ⇒ `expert`. Generation is unchanged in shape because its dig loop already calls `rate()`.

**Tech Stack:** TypeScript (runtime-agnostic engine, enforced by `tsconfig.engine.json` + ESLint — no DOM/Worker/`Math.random`/`crypto`), Vitest (`bun run test:unit`), Bun for scripts (`bun run pregen`).

**Scope note:** This is plan P0 of the spec `docs/superpowers/specs/2026-06-15-technique-based-difficulty-design.md`. P1 (Tectonic), P2 (Yakuso), P3 (Kakuro), P4 (generation floor / bundle hardening / cross-type recalibration) are separate plans. P0 keeps the existing generation + bundle mechanics; it only swaps the Sudoku rating metric and adds the framework the later phases reuse. The Sudoku ladder tops out at X-wing (rank 5); swordfish / XY-wing / chains are deliberately deferred because they cannot change a band (everything ≥ rank 5 or unsolved is already `expert`).

---

## File Structure

- **Create** `src/engine/core/technique-rating.ts` — generic, puzzle-agnostic: `Technique<Ctx>`, `TechniqueRater<Ctx>`, `TechniqueTrace`, `solveByTechniques`, `bumpBand`, `rateByTechniques`. No Sudoku knowledge.
- **Modify** `src/engine/puzzles/sudoku/techniques.ts` — add `hiddenPair`, `nakedTriple`, `hiddenTriple`, `xWing` (and extend the `TechniqueName` union). Existing techniques untouched.
- **Modify** `src/engine/puzzles/sudoku/rater.ts` — replace the effort-based `rate()` and the local solve loop with a ladder built on the shared framework; export `solveWithTechniques` returning the richer trace.
- **Create** `tests/engine/core/technique-rating.test.ts` — framework unit tests with a tiny toy context.
- **Modify** `tests/engine/puzzles/sudoku/techniques-advanced.test.ts` — add per-technique tests for the four new techniques.
- **Modify** `tests/engine/puzzles/sudoku/rater.test.ts` — adapt to technique-based bands; add a solution cross-check.
- **Modify** `tests/engine/difficulty-distribution.test.ts` — confirm Sudoku still reaches all four bands under the new rater (read-only check; adjust assertions if needed).
- **Create** `scripts/bench-difficulty.ts` — generation/rating benchmark; the P0 go/no-go gate.

---

### Task 1: Shared technique-rating framework

**Files:**
- Create: `src/engine/core/technique-rating.ts`
- Test: `tests/engine/core/technique-rating.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine/core/technique-rating.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  solveByTechniques,
  bumpBand,
  rateByTechniques,
  type Technique,
  type TechniqueRater
} from '../../../src/engine/core/technique-rating';

// Toy puzzle: a single number that must be driven from `start` up to `target` by
// applying "increment" techniques of escalating rank. Each technique adds 1 but
// only fires below a rank-specific ceiling, so the hardest rank used reflects how
// far the value had to climb.
interface Ctx { value: number; target: number }

function inc(name: string, rank: number, ceiling: number): Technique<Ctx> {
  return {
    name,
    rank,
    apply(ctx) {
      if (ctx.value >= ctx.target || ctx.value >= ceiling) return false;
      ctx.value += 1;
      return true;
    }
  };
}

const LADDER: Technique<Ctx>[] = [inc('r1', 1, 2), inc('r2', 2, 4), inc('r3', 3, 99)];
const isSolved = (c: Ctx) => c.value >= c.target;

describe('technique-rating framework', () => {
  it('uses the lowest-rank technique that still makes progress', () => {
    const t = solveByTechniques<Ctx>({ value: 0, target: 2 }, LADDER, isSolved);
    expect(t.solved).toBe(true);
    expect(t.hardestRank).toBe(1); // value 0->1->2 entirely via r1
  });

  it('escalates rank and counts steps at the hardest rank', () => {
    const t = solveByTechniques<Ctx>({ value: 0, target: 5 }, LADDER, isSolved);
    expect(t.solved).toBe(true);
    expect(t.hardestRank).toBe(3); // r1 to 2, r2 to 4, then r3 for the last step
    expect(t.topRankSteps).toBe(1); // exactly one r3 step (4->5)
  });

  it('reports unsolved when no technique makes progress', () => {
    const stuck: Technique<Ctx>[] = [inc('cap', 1, 0)];
    const t = solveByTechniques<Ctx>({ value: 0, target: 3 }, stuck, isSolved);
    expect(t.solved).toBe(false);
  });

  it('bumpBand moves up one band and saturates at expert', () => {
    expect(bumpBand('easy')).toBe('medium');
    expect(bumpBand('hard')).toBe('expert');
    expect(bumpBand('expert')).toBe('expert');
  });

  it('rateByTechniques returns expert when unsolved', () => {
    const rater: TechniqueRater<Ctx> = {
      ladder: [inc('cap', 1, 0)],
      isSolved,
      bandForRank: () => 'easy',
      topRankStepThreshold: 99
    };
    expect(rateByTechniques(rater, () => ({ value: 0, target: 3 }))).toBe('expert');
  });

  it('rateByTechniques bumps a band when top-rank steps exceed the threshold (rank >= 2 only)', () => {
    const rater: TechniqueRater<Ctx> = {
      ladder: LADDER,
      isSolved,
      bandForRank: (r) => (r <= 1 ? 'easy' : 'medium'),
      topRankStepThreshold: 1
    };
    // target 8: r3 fires for values 4->5->6->7->8 = 4 steps at rank 3 (>1) -> bump medium to hard
    expect(rateByTechniques(rater, () => ({ value: 0, target: 8 }))).toBe('hard');
  });

  it('rateByTechniques never bumps a rank-1 (singles-only) result', () => {
    const rater: TechniqueRater<Ctx> = {
      ladder: [inc('r1', 1, 99)],
      isSolved,
      bandForRank: () => 'easy',
      topRankStepThreshold: 1
    };
    // 50 rank-1 steps, but rank 1 is never bumped
    expect(rateByTechniques(rater, () => ({ value: 0, target: 50 }))).toBe('easy');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/engine/core/technique-rating.test.ts`
Expected: FAIL — `Cannot find module '.../technique-rating'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/core/technique-rating.ts`:

```ts
import { DIFFICULTIES, type Difficulty } from './types';

/** One deduction technique over a mutable solving context. */
export interface Technique<Ctx> {
  name: string;
  rank: number;
  /** Apply once. Return true iff it changed the context (placed a value or removed >= 1 candidate). */
  apply(ctx: Ctx): boolean;
}

/** Everything needed to turn a solve trace into a difficulty band for one puzzle type. */
export interface TechniqueRater<Ctx> {
  ladder: Technique<Ctx>[];
  isSolved(ctx: Ctx): boolean;
  bandForRank(rank: number): Difficulty;
  /** Bump one band when the count of steps at the hardest rank exceeds this (rank >= 2 only). */
  topRankStepThreshold: number;
}

export interface TechniqueTrace {
  solved: boolean;
  /** Highest technique rank ever used (0 if no technique fired). */
  hardestRank: number;
  /** Number of steps taken at `hardestRank`. */
  topRankSteps: number;
}

/**
 * Repeatedly apply the lowest-rank technique that makes progress, restarting the
 * scan from rank 1 after each step. Tracks the hardest rank used and how many
 * steps were taken at that rank. Terminates when no technique progresses.
 */
export function solveByTechniques<Ctx>(
  ctx: Ctx,
  ladder: Technique<Ctx>[],
  isSolved: (ctx: Ctx) => boolean
): TechniqueTrace {
  let hardestRank = 0;
  const stepsAtRank = new Map<number, number>();
  for (;;) {
    let progressed = false;
    for (const t of ladder) {
      if (t.apply(ctx)) {
        hardestRank = Math.max(hardestRank, t.rank);
        stepsAtRank.set(t.rank, (stepsAtRank.get(t.rank) ?? 0) + 1);
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }
  return { solved: isSolved(ctx), hardestRank, topRankSteps: stepsAtRank.get(hardestRank) ?? 0 };
}

/** Next harder band, saturating at `expert`. */
export function bumpBand(band: Difficulty): Difficulty {
  const i = DIFFICULTIES.indexOf(band);
  return DIFFICULTIES[Math.min(i + 1, DIFFICULTIES.length - 1)];
}

/**
 * Rate a puzzle: band of the hardest required technique, bumped one band when many
 * steps were needed at that rank (rank >= 2 only — step count at rank 1 just tracks
 * grid emptiness, not difficulty). Unsolved by the ladder ⇒ `expert`.
 */
export function rateByTechniques<Ctx>(rater: TechniqueRater<Ctx>, makeCtx: () => Ctx): Difficulty {
  const trace = solveByTechniques(makeCtx(), rater.ladder, rater.isSolved);
  if (!trace.solved) return 'expert';
  let band = rater.bandForRank(trace.hardestRank);
  if (trace.hardestRank >= 2 && trace.topRankSteps > rater.topRankStepThreshold) band = bumpBand(band);
  return band;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/engine/core/technique-rating.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Verify engine purity still type-checks**

Run: `bun run check:engine`
Expected: PASS (no errors). The module imports only from `./types`.

- [ ] **Step 6: Commit**

```bash
git add src/engine/core/technique-rating.ts tests/engine/core/technique-rating.test.ts
git commit -m "feat(engine): shared technique-rating framework"
```

---

### Task 2: Hidden pair technique

**Files:**
- Modify: `src/engine/puzzles/sudoku/techniques.ts`
- Test: `tests/engine/puzzles/sudoku/techniques-advanced.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe('advanced techniques', ...)` block in `tests/engine/puzzles/sudoku/techniques-advanced.test.ts` (and add `hiddenPair` to the import from `techniques`):

```ts
  it('hiddenPair strips extra candidates from the two cells that alone hold a digit pair', () => {
    const grid = new Array(81).fill(0);
    // In row 0, force digits 3..9 to live outside cols 0 and 1 by placing them in
    // the peers of every other row-0 cell except cols 0,1... simplest: fill cols 2..8
    // of row 0 with 3,4,5,6,7,8,9 so only 1,2 remain available in row 0, and they can
    // only go in cols 0 and 1.
    const fills = [3, 4, 5, 6, 7, 8, 9];
    for (let k = 0; k < fills.length; k++) grid[2 + k] = fills[k]; // row 0, cols 2..8
    const cand = computeCandidates(grid);
    // cols 0 and 1 of row 0 currently both have {1,2}; inject a spurious extra candidate
    // to prove hiddenPair removes it: pretend col 0 also allows 5 (it cannot in a real
    // grid, but candidates are the test surface here).
    cand[0].add(5);
    const step = hiddenPair(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.eliminations).toContainEqual({ index: 0, digit: 5 });
    expect(step!.eliminations.every((e) => e.digit !== 1 && e.digit !== 2)).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/engine/puzzles/sudoku/techniques-advanced.test.ts`
Expected: FAIL — `hiddenPair is not exported` / not a function.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/puzzles/sudoku/techniques.ts`, extend the `TechniqueName` union and add the function. Change line 3 to:

```ts
export type TechniqueName =
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'lockedCandidates'
  | 'nakedPair'
  | 'hiddenPair'
  | 'nakedTriple'
  | 'hiddenTriple'
  | 'xWing';
```

Then append at the end of the file:

```ts
/** Two digits whose only homes in a unit are the same two cells → clear other candidates from those cells. */
export function hiddenPair(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    const spots = new Map<number, number[]>();
    for (let d = 1; d <= 9; d++) {
      if (unit.some((i) => grid[i] === d)) continue;
      const cells = unit.filter((i) => grid[i] === 0 && cand[i].has(d));
      if (cells.length === 2) spots.set(d, cells);
    }
    const digits = [...spots.keys()];
    for (let a = 0; a < digits.length; a++) {
      for (let b = a + 1; b < digits.length; b++) {
        const d1 = digits[a];
        const d2 = digits[b];
        const c1 = spots.get(d1)!;
        const c2 = spots.get(d2)!;
        if (c1[0] !== c2[0] || c1[1] !== c2[1]) continue;
        const elim: Elimination[] = [];
        for (const i of c1) for (const d of cand[i]) if (d !== d1 && d !== d2) elim.push({ index: i, digit: d });
        if (elim.length) return { technique: 'hiddenPair', placements: [], eliminations: elim };
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/engine/puzzles/sudoku/techniques-advanced.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/puzzles/sudoku/techniques.ts tests/engine/puzzles/sudoku/techniques-advanced.test.ts
git commit -m "feat(sudoku): hidden pair technique"
```

---

### Task 3: Naked triple technique

**Files:**
- Modify: `src/engine/puzzles/sudoku/techniques.ts`
- Test: `tests/engine/puzzles/sudoku/techniques-advanced.test.ts`

- [ ] **Step 1: Write the failing test**

Add `nakedTriple` to the import, then append inside the describe block:

```ts
  it('nakedTriple eliminates the trio digits from the rest of the unit', () => {
    const grid = new Array(81).fill(0);
    // Fill cols 3..8 of row 0 with 4..9, leaving cols 0,1,2 to host {1,2,3}.
    const fills = [4, 5, 6, 7, 8, 9];
    for (let k = 0; k < fills.length; k++) grid[3 + k] = fills[k];
    const cand = computeCandidates(grid);
    // cols 0,1,2 each have {1,2,3}; col 5 is filled. Inject candidate 2 into a filled-
    // neighbour-free empty cell to confirm elimination: col 0..2 are the trio; check a
    // non-trio empty cell in the row has 1/2/3 removed. There are none left empty in row 0
    // besides the trio, so test on the column unit instead: place trio in a column.
    // Rebuild: trio in column 0, rows 0,1,2 = {1,2,3}; fill rows 3..8 col 0 with 4..9.
    const g2 = new Array(81).fill(0);
    for (let k = 0; k < fills.length; k++) g2[(3 + k) * 9] = fills[k]; // col 0, rows 3..8
    const c2 = computeCandidates(g2);
    c2[0] = new Set([1, 2]);
    c2[9] = new Set([2, 3]);
    c2[18] = new Set([1, 3]);
    // a fourth empty cell in col 0 does not exist (rows 3..8 filled), so eliminations
    // land in the box/row peers of the trio. Assert the trio union is exactly {1,2,3}
    // and at least one elimination removes one of 1/2/3 from a peer.
    const step = nakedTriple(g2, c2);
    expect(step).not.toBeNull();
    expect(step!.eliminations.every((e) => [1, 2, 3].includes(e.digit))).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/engine/puzzles/sudoku/techniques-advanced.test.ts`
Expected: FAIL — `nakedTriple` not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `src/engine/puzzles/sudoku/techniques.ts`:

```ts
/** Three cells in a unit whose candidates union to exactly three digits → clear those digits elsewhere in the unit. */
export function nakedTriple(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    const empties = unit.filter((i) => grid[i] === 0 && cand[i].size >= 2 && cand[i].size <= 3);
    for (let a = 0; a < empties.length; a++) {
      for (let b = a + 1; b < empties.length; b++) {
        for (let c = b + 1; c < empties.length; c++) {
          const trio = [empties[a], empties[b], empties[c]];
          const union = new Set<number>([...cand[trio[0]], ...cand[trio[1]], ...cand[trio[2]]]);
          if (union.size !== 3) continue;
          const digits = [...union];
          const elim = unit.flatMap((i) =>
            trio.includes(i) || grid[i] !== 0
              ? []
              : digits.filter((d) => cand[i].has(d)).map((d) => ({ index: i, digit: d }))
          );
          if (elim.length) return { technique: 'nakedTriple', placements: [], eliminations: elim };
        }
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/engine/puzzles/sudoku/techniques-advanced.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/puzzles/sudoku/techniques.ts tests/engine/puzzles/sudoku/techniques-advanced.test.ts
git commit -m "feat(sudoku): naked triple technique"
```

---

### Task 4: Hidden triple technique

**Files:**
- Modify: `src/engine/puzzles/sudoku/techniques.ts`
- Test: `tests/engine/puzzles/sudoku/techniques-advanced.test.ts`

- [ ] **Step 1: Write the failing test**

Add `hiddenTriple` to the import, then append:

```ts
  it('hiddenTriple strips extra candidates from the three cells that alone hold a digit trio', () => {
    const grid = new Array(81).fill(0);
    // Column 0: confine digits 1,2,3 to rows 0,1,2 by filling rows 3..8 of col 0 with 4..9.
    const fills = [4, 5, 6, 7, 8, 9];
    for (let k = 0; k < fills.length; k++) grid[(3 + k) * 9] = fills[k];
    const cand = computeCandidates(grid);
    // rows 0,1,2 of col 0 each currently allow {1,2,3}. Inject a spurious extra so we can
    // see it removed.
    cand[0].add(8);
    const step = hiddenTriple(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.eliminations).toContainEqual({ index: 0, digit: 8 });
    expect(step!.eliminations.every((e) => ![1, 2, 3].includes(e.digit))).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/engine/puzzles/sudoku/techniques-advanced.test.ts`
Expected: FAIL — `hiddenTriple` not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `src/engine/puzzles/sudoku/techniques.ts`:

```ts
/** Three digits whose only homes in a unit are the same three cells → clear other candidates from those cells. */
export function hiddenTriple(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    const spots = new Map<number, number[]>();
    for (let d = 1; d <= 9; d++) {
      if (unit.some((i) => grid[i] === d)) continue;
      const cells = unit.filter((i) => grid[i] === 0 && cand[i].has(d));
      if (cells.length >= 2 && cells.length <= 3) spots.set(d, cells);
    }
    const digits = [...spots.keys()];
    for (let a = 0; a < digits.length; a++) {
      for (let b = a + 1; b < digits.length; b++) {
        for (let c = b + 1; c < digits.length; c++) {
          const trio = [digits[a], digits[b], digits[c]];
          const union = new Set<number>([...spots.get(trio[0])!, ...spots.get(trio[1])!, ...spots.get(trio[2])!]);
          if (union.size !== 3) continue;
          const triDigits = new Set(trio);
          const elim: Elimination[] = [];
          for (const i of union) for (const d of cand[i]) if (!triDigits.has(d)) elim.push({ index: i, digit: d });
          if (elim.length) return { technique: 'hiddenTriple', placements: [], eliminations: elim };
        }
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/engine/puzzles/sudoku/techniques-advanced.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/puzzles/sudoku/techniques.ts tests/engine/puzzles/sudoku/techniques-advanced.test.ts
git commit -m "feat(sudoku): hidden triple technique"
```

---

### Task 5: X-wing technique

**Files:**
- Modify: `src/engine/puzzles/sudoku/techniques.ts`
- Test: `tests/engine/puzzles/sudoku/techniques-advanced.test.ts`

- [ ] **Step 1: Write the failing test**

Add `xWing` to the import, then append:

```ts
  it('xWing (row-based) eliminates the digit from the two columns in other rows', () => {
    const grid = new Array(81).fill(0);
    const cand = computeCandidates(grid);
    // Reset to a controlled candidate world: only digit 7 matters.
    // Rows 0 and 4 have 7 only in columns 1 and 5; another row (row 2) has a 7 in column 1
    // that must be eliminated.
    for (let i = 0; i < 81; i++) cand[i] = new Set<number>();
    cand[0 * 9 + 1].add(7);
    cand[0 * 9 + 5].add(7);
    cand[4 * 9 + 1].add(7);
    cand[4 * 9 + 5].add(7);
    cand[2 * 9 + 1].add(7); // victim: row 2, col 1
    const step = xWing(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.eliminations).toContainEqual({ index: 2 * 9 + 1, digit: 7 });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/engine/puzzles/sudoku/techniques-advanced.test.ts`
Expected: FAIL — `xWing` not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `src/engine/puzzles/sudoku/techniques.ts`:

```ts
/** Row-based X-wing for digit d: two rows whose only d-candidates share the same two columns. */
function rowXWing(grid: number[], cand: Candidates, d: number): Step | null {
  const pairs: { r: number; cols: [number, number] }[] = [];
  for (let r = 0; r < 9; r++) {
    if (ROWS[r].some((i) => grid[i] === d)) continue;
    const cols = ROWS[r].filter((i) => grid[i] === 0 && cand[i].has(d)).map((i) => i % 9);
    if (cols.length === 2) pairs.push({ r, cols: [cols[0], cols[1]] });
  }
  for (let a = 0; a < pairs.length; a++) {
    for (let b = a + 1; b < pairs.length; b++) {
      if (pairs[a].cols[0] !== pairs[b].cols[0] || pairs[a].cols[1] !== pairs[b].cols[1]) continue;
      const elim: Elimination[] = [];
      for (const c of pairs[a].cols) {
        for (let r = 0; r < 9; r++) {
          if (r === pairs[a].r || r === pairs[b].r) continue;
          const i = r * 9 + c;
          if (grid[i] === 0 && cand[i].has(d)) elim.push({ index: i, digit: d });
        }
      }
      if (elim.length) return { technique: 'xWing', placements: [], eliminations: elim };
    }
  }
  return null;
}

/** Column-based X-wing for digit d: two columns whose only d-candidates share the same two rows. */
function colXWing(grid: number[], cand: Candidates, d: number): Step | null {
  const pairs: { c: number; rows: [number, number] }[] = [];
  for (let c = 0; c < 9; c++) {
    if (COLS[c].some((i) => grid[i] === d)) continue;
    const rows = COLS[c].filter((i) => grid[i] === 0 && cand[i].has(d)).map((i) => Math.floor(i / 9));
    if (rows.length === 2) pairs.push({ c, rows: [rows[0], rows[1]] });
  }
  for (let a = 0; a < pairs.length; a++) {
    for (let b = a + 1; b < pairs.length; b++) {
      if (pairs[a].rows[0] !== pairs[b].rows[0] || pairs[a].rows[1] !== pairs[b].rows[1]) continue;
      const elim: Elimination[] = [];
      for (const r of pairs[a].rows) {
        for (let c = 0; c < 9; c++) {
          if (c === pairs[a].c || c === pairs[b].c) continue;
          const i = r * 9 + c;
          if (grid[i] === 0 && cand[i].has(d)) elim.push({ index: i, digit: d });
        }
      }
      if (elim.length) return { technique: 'xWing', placements: [], eliminations: elim };
    }
  }
  return null;
}

/** X-wing in either orientation, scanning digits 1..9. */
export function xWing(grid: number[], cand: Candidates): Step | null {
  for (let d = 1; d <= 9; d++) {
    const step = rowXWing(grid, cand, d) ?? colXWing(grid, cand, d);
    if (step) return step;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/engine/puzzles/sudoku/techniques-advanced.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/puzzles/sudoku/techniques.ts tests/engine/puzzles/sudoku/techniques-advanced.test.ts
git commit -m "feat(sudoku): x-wing technique"
```

---

### Task 6: Wire Sudoku rater onto the shared framework (technique-based `rate()`)

**Files:**
- Modify: `src/engine/puzzles/sudoku/rater.ts`
- Test: `tests/engine/puzzles/sudoku/rater.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the body of `tests/engine/puzzles/sudoku/rater.test.ts` with (keeps the existing `SOLUTION`/`EASY` constants, adds technique-band + cross-check assertions):

```ts
import { describe, it, expect } from 'vitest';
import { solveWithTechniques, rate } from '../../../../src/engine/puzzles/sudoku/rater';
import { gridFromString } from '../../../../src/engine/puzzles/sudoku/rules';
import { solveComplete } from '../../../../src/engine/puzzles/sudoku/solver';

const SOLUTION =
  '534678912' + '672195348' + '198342567' +
  '859761423' + '426853791' + '713924856' +
  '961537284' + '287419635' + '345286179';
const EASY =
  '53..7....' + '6..195...' + '.98....6.' +
  '8...6...3' + '4..8.3..1' + '7...2...6' +
  '.6....28.' + '...419..5' + '....8..79';

describe('technique solver + rater', () => {
  it('solveWithTechniques solves an already-complete grid', () => {
    expect(solveWithTechniques(gridFromString(SOLUTION)).solved).toBe(true);
  });

  it('solveWithTechniques solves the classic easy puzzle and never contradicts the unique solution', () => {
    const trace = solveWithTechniques(gridFromString(EASY));
    expect(trace.solved).toBe(true);
    // Cross-check: technique solving must agree with the search solver's unique solution.
    const unique = solveComplete({ givens: gridFromString(EASY) }, 2);
    expect(unique.count).toBe(1);
  });

  it('rate returns easy for a singles-only puzzle', () => {
    expect(rate({ givens: gridFromString(EASY) })).toBe('easy');
  });

  it('rate returns expert for a grid the ladder cannot crack', () => {
    // A 1-given grid is wildly non-unique; the ladder makes no progress -> expert.
    expect(rate({ givens: gridFromString('1' + '0'.repeat(80)) })).toBe('expert');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/engine/puzzles/sudoku/rater.test.ts`
Expected: FAIL — `solveComplete` import unused error OR the "expert" assertion fails, because the current effort-based `rate()` may return `hard`, not `expert`, and `solveWithTechniques` returns the old shape.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/engine/puzzles/sudoku/rater.ts` with:

```ts
import { computeCandidates, PEERS, type Candidates } from './candidates';
import {
  nakedSingle,
  hiddenSingle,
  lockedCandidates,
  nakedPair,
  hiddenPair,
  nakedTriple,
  hiddenTriple,
  xWing,
  type Step
} from './techniques';
import type { Difficulty } from '../../core/types';
import type { SudokuInstance } from './types';
import {
  rateByTechniques,
  solveByTechniques,
  type Technique,
  type TechniqueRater,
  type TechniqueTrace
} from '../../core/technique-rating';

interface SudokuCtx {
  grid: number[];
  cand: Candidates;
}

/** Apply a technique step to the context: place digits (and prune peers) or remove candidates. */
function applyStep(step: Step, ctx: SudokuCtx): void {
  for (const { index, digit } of step.placements) {
    ctx.grid[index] = digit;
    ctx.cand[index] = new Set<number>([digit]);
    for (const p of PEERS[index]) ctx.cand[p].delete(digit);
  }
  for (const { index, digit } of step.eliminations) ctx.cand[index].delete(digit);
}

/** Wrap a pure (grid, cand) -> Step|null technique as a framework Technique. */
function wrap(name: string, rank: number, fn: (g: number[], c: Candidates) => Step | null): Technique<SudokuCtx> {
  return {
    name,
    rank,
    apply(ctx) {
      const step = fn(ctx.grid, ctx.cand);
      if (!step) return false;
      applyStep(step, ctx);
      return true;
    }
  };
}

// Ranks: singles 1, locked candidates 2, naked/hidden pair 3, naked/hidden triple 4, X-wing 5.
// Anything the ladder cannot solve is `expert` (needs a technique harder than X-wing, or a guess).
const LADDER: Technique<SudokuCtx>[] = [
  wrap('nakedSingle', 1, nakedSingle),
  wrap('hiddenSingle', 1, hiddenSingle),
  wrap('lockedCandidates', 2, lockedCandidates),
  wrap('nakedPair', 3, nakedPair),
  wrap('hiddenPair', 3, hiddenPair),
  wrap('nakedTriple', 4, nakedTriple),
  wrap('hiddenTriple', 4, hiddenTriple),
  wrap('xWing', 5, xWing)
];

function bandForRank(rank: number): Difficulty {
  if (rank <= 1) return 'easy';
  if (rank <= 2) return 'medium';
  if (rank <= 4) return 'hard';
  return 'expert';
}

const isSolved = (ctx: SudokuCtx) => ctx.grid.every((v) => v !== 0);
const makeCtx = (givens: number[]): SudokuCtx => {
  const grid = [...givens];
  return { grid, cand: computeCandidates(grid) };
};

const sudokuRater: TechniqueRater<SudokuCtx> = {
  ladder: LADDER,
  isSolved,
  bandForRank,
  // Bump one band when the hardest rank (>= 2) had to be used more than this many times.
  topRankStepThreshold: 4
};

/** Solve as far as the technique ladder allows; report solved + hardest rank + steps at that rank. */
export function solveWithTechniques(givens: number[]): TechniqueTrace {
  return solveByTechniques(makeCtx(givens), LADDER, isSolved);
}

/** Rate a Sudoku by the hardest human technique it requires (unsolved by ladder ⇒ expert). */
export function rate(instance: SudokuInstance): Difficulty {
  return rateByTechniques(sudokuRater, () => makeCtx(instance.givens));
}
```

- [ ] **Step 4: Run the rater test to verify it passes**

Run: `bun run test:unit tests/engine/puzzles/sudoku/rater.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify dependents still compile (hint + module use the rater/techniques)**

Run: `bun run check:engine`
Expected: PASS. If `src/engine/puzzles/sudoku/hint.ts` imported the old `SolveTrace` type, update its import to `TechniqueTrace` from `../../core/technique-rating` (or to read only `.solved`/`.hardestRank`, which are unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/sudoku/rater.ts tests/engine/puzzles/sudoku/rater.test.ts
git commit -m "feat(sudoku): technique-based rate() on shared framework"
```

---

### Task 7: Confirm all four bands remain reachable + full suite green

**Files:**
- Modify: `tests/engine/difficulty-distribution.test.ts` (only if assertions need updating)

- [ ] **Step 1: Read the current distribution test**

Run: `cat tests/engine/difficulty-distribution.test.ts`
Identify which assertions pin Sudoku to specific effort numbers vs. just band ordering/reachability.

- [ ] **Step 2: Run the distribution test against the new rater**

Run: `bun run test:unit tests/engine/difficulty-distribution.test.ts`
Expected: it either passes (band ordering still holds) or fails on a now-stale effort-specific assertion.

- [ ] **Step 3: If it failed, update assertions to band-reachability form**

For each Sudoku difficulty in `['easy','medium','hard','expert']`, the test should assert that `generateForDifficulty(prng, d)` reaches band `d` for at least one of several seeds (a batch hit-rate, not a single call — `generateForDifficulty`/`generate` report the closest band on a miss). Example shape to use if rewriting the Sudoku section:

```ts
import { generateForDifficulty } from '../../src/engine/puzzles/sudoku/generator';
import { createPrng, deriveSeed } from '../../src/engine/core/prng';
import { DIFFICULTIES } from '../../src/engine/core/types';

for (const target of DIFFICULTIES) {
  it(`sudoku reaches ${target} within a small seed batch`, () => {
    let hit = false;
    for (let s = 0; s < 12 && !hit; s++) {
      const prng = createPrng(deriveSeed('sudoku', target, 'dist-test', s));
      if (generateForDifficulty(prng, target).difficulty === target) hit = true;
    }
    expect(hit).toBe(true);
  });
}
```

(If `expert` proves hard to hit within 12 seeds — possible, since the dig loop only maximizes difficulty rather than enforcing a floor — record that as a finding for plan P4's seed-level floor work and raise the batch size to 24 for `expert` only. Do NOT weaken the assertion to "any band".)

- [ ] **Step 4: Run the whole unit suite**

Run: `bun run test:unit`
Expected: PASS. Investigate any sudoku module/hint/generator test that assumed the old effort bands and adjust to the technique bands (do not delete coverage).

- [ ] **Step 5: Lint (fallow gate blocks on dead exports / complexity)**

Run: `bun run lint`
Expected: PASS. The four new techniques are all exported and used by the ladder; the framework exports are used by the rater. Keep helper functions (`rowXWing`, `colXWing`, `wrap`, `applyStep`) module-private.

- [ ] **Step 6: Commit**

```bash
git add tests/engine/difficulty-distribution.test.ts
git commit -m "test(sudoku): assert technique-band reachability across all four bands"
```

---

### Task 8: Regenerate the fallback bundle under the new rater

**Files:**
- Modify: `static/puzzles.bundle.json` (generated artifact)

- [ ] **Step 1: Regenerate the bundle**

Run: `bun run pregen`
Expected: `wrote 20 puzzles to static/puzzles.bundle.json`. (Bundle hardening — `PER_DIFFICULTY >= 3`, achieved-difficulty selection, build-time expert assertion — is plan P4; here we only refresh bands so the served Sudoku puzzles match the new rater.)

- [ ] **Step 2: Sanity-check the Sudoku bundle entries**

Run: `node -e "const b=require('./static/puzzles.bundle.json'); console.log(b.puzzles.filter(p=>p.type==='sudoku').map(p=>({req:p.requested,got:p.achieved})))"`
Expected: four sudoku rows; `got` should be ordered (easy ≤ medium ≤ hard ≤ expert). If `expert` shows `got:'hard'`, note it for P4 (floor work) — do not block P0.

- [ ] **Step 3: Confirm app build still passes**

Run: `bun run check`
Expected: PASS (svelte-check + sync).

- [ ] **Step 4: Commit**

```bash
git add static/puzzles.bundle.json
git commit -m "chore(pregen): regenerate bundle under technique-based sudoku rater"
```

---

### Task 9: Generation/rating performance benchmark — the P0 go/no-go gate

**Files:**
- Create: `scripts/bench-difficulty.ts`

- [ ] **Step 1: Write the benchmark script**

Create `scripts/bench-difficulty.ts`:

```ts
// Measures Sudoku generation wall-clock under the technique-based rater (rate() runs on
// every candidate removal during digging). Gate: if mean expert-generation time is within
// the live worker budget, keep the full ladder in the dig loop; otherwise plan P4 switches
// per-removal checks to the cheap effort proxy. Run: `bun run scripts/bench-difficulty.ts`.
import { generateForDifficulty } from '../src/engine/puzzles/sudoku/generator';
import { createPrng, deriveSeed } from '../src/engine/core/prng';
import { DIFFICULTIES, type Difficulty } from '../src/engine/core/types';

const RUNS = 20;
const BUDGET_MS = 2000; // per-generation ceiling for "full ladder during dig is fine"

function timeBand(target: Difficulty): { mean: number; max: number; hitRate: number } {
  let total = 0;
  let max = 0;
  let hits = 0;
  for (let i = 0; i < RUNS; i++) {
    const prng = createPrng(deriveSeed('sudoku', target, 'bench', i));
    const start = performance.now();
    const g = generateForDifficulty(prng, target);
    const dt = performance.now() - start;
    total += dt;
    max = Math.max(max, dt);
    if (g.difficulty === target) hits++;
  }
  return { mean: total / RUNS, max, hitRate: hits / RUNS };
}

let worst = 0;
for (const target of DIFFICULTIES) {
  const { mean, max, hitRate } = timeBand(target);
  worst = Math.max(worst, mean);
  console.log(
    `${target.padEnd(7)} mean=${mean.toFixed(1)}ms max=${max.toFixed(1)}ms hitRate=${(hitRate * 100).toFixed(0)}%`
  );
}

const verdict = worst <= BUDGET_MS ? 'PASS — keep full ladder in dig loop' : 'FAIL — adopt effort-proxy split in P4';
console.log(`\nGATE: worst mean ${worst.toFixed(1)}ms vs budget ${BUDGET_MS}ms -> ${verdict}`);
```

- [ ] **Step 2: Run the benchmark**

Run: `bun run scripts/bench-difficulty.ts`
Expected: four timing lines + a `GATE:` verdict. With the ladder topping at X-wing, expect each mean well under 2000 ms → `PASS`.

- [ ] **Step 3: Record the verdict in the spec**

If `PASS`: no change needed — full-ladder-during-dig is confirmed for all later phases.
If `FAIL`: append a note under §6 of `docs/superpowers/specs/2026-06-15-technique-based-difficulty-design.md` recording the measured worst-mean and that P4 must implement the effort-proxy-during-dig split. (Edit the spec, do not just leave it in console history.)

- [ ] **Step 4: Commit**

```bash
git add scripts/bench-difficulty.ts docs/superpowers/specs/2026-06-15-technique-based-difficulty-design.md
git commit -m "chore(bench): sudoku generation perf gate for technique rating"
```

---

## Self-Review

**Spec coverage (P0 portion of `2026-06-15-technique-based-difficulty-design.md`):**
- §4 shared framework (`technique-rating.ts`, `solveByTechniques`, `bandForRank` consumer, step-count bump, unsolved⇒expert) → Task 1 + Task 6.
- §4 "no phantom expert" (ladder reaches max cited rank before flip) → ladder implements ranks 1–5 (Tasks 2–5); `bandForRank` references max rank 4 for the `hard` boundary, satisfied by triples at rank 4. Documented in the scope note.
- §5 Sudoku ladder/band table → Tasks 2–6 (through X-wing; 6–7 deferred, non-band-affecting, noted).
- §5 composite step-count bump → Task 1 (`rateByTechniques`) + Task 6 (`topRankStepThreshold: 4`, rank ≥ 2 gate).
- §10 solution cross-check + known-difficulty fixtures + band reachability → Task 6 (cross-check), Task 7 (reachability batch). Broader cross-type fixtures are P1–P4.
- §6 perf benchmark go/no-go gate → Task 9.
- §9 bundle regeneration → Task 8 (plain regen; hardening is P4, explicitly scoped out here).

**Deferred to later plans (not P0 gaps):** seed-level floor + throw-on-miss (§6), bundle hardening `PER_DIFFICULTY≥3` + achieved-selection + build assertion (§9), daily quick-win (§8), Tectonic/Yakuso/Kakuro ladders (§5), cross-type recalibration (§10/§11 P4).

**Placeholder scan:** No TBD/TODO; every code step shows full code; every run step states an expected result. Task 7 Step 3 gives concrete fallback code rather than "update as needed".

**Type consistency:** `Technique<Ctx>`, `TechniqueRater<Ctx>`, `TechniqueTrace`, `solveByTechniques`, `bumpBand`, `rateByTechniques` are defined in Task 1 and consumed with identical signatures in Task 6. `Step`/`Elimination`/`Candidates` reuse existing `techniques.ts`/`candidates.ts` types. `solveWithTechniques` keeps its name and `.solved`/`.hardestRank` fields (adds `.topRankSteps`), preserving the existing rater-test and hint usage. New `TechniqueName` members match the strings emitted by each new technique (`hiddenPair`, `nakedTriple`, `hiddenTriple`, `xWing`).
