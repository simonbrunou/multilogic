# Sudoku Generation + Rating + Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the engine foundation into a real Sudoku generator: a human-technique solver that rates difficulty and powers hints, a clue-digging generator that produces unique puzzles at a target difficulty, the assembled Sudoku `DeductionPuzzle` module, and a build-time pre-generation script.

**Architecture:** Builds on Plan 1 (`core/{prng,dlx,types}`, `puzzles/sudoku/{rules,solver,fullgrid}`). Adds a candidate-grid model and a small ladder of human techniques (naked/hidden single → locked candidates → naked pair). The rater solves with that ladder and reports the hardest technique needed → difficulty band; the generator digs clues from a full grid while preserving uniqueness and capping difficulty; the module wires it all into the `DeductionPuzzle` interface from Plan 1. Engine stays pure runtime-agnostic TS; `scripts/pregen.ts` is a build script (Node/Bun, not engine).

**Tech Stack:** TypeScript, Bun, Vitest, fast-check.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/puzzles/sudoku/candidates.ts` | `UNITS`/`ROWS`/`COLS`/`BOXES`/`PEERS` precomputed; `computeCandidates(grid)` |
| `src/engine/puzzles/sudoku/techniques.ts` | `Step` type + technique fns: nakedSingle, hiddenSingle, lockedCandidates, nakedPair |
| `src/engine/puzzles/sudoku/rater.ts` | `solveWithTechniques`, `rate(instance) → Difficulty` |
| `src/engine/puzzles/sudoku/hint.ts` | `getHint(instance, state) → Hint | null` from current play state |
| `src/engine/puzzles/sudoku/generator.ts` | `generateForDifficulty(prng, target)` — dig unique puzzle, cap difficulty |
| `src/engine/puzzles/sudoku/index.ts` | Assemble the `sudoku` `DeductionPuzzle` module |
| `scripts/pregen.ts` | Build-time fallback bundle (`buildBundle()` + file write) |
| `tests/engine/puzzles/sudoku/**`, `tests/scripts/**` | Vitest + fast-check |

All `src/engine/**` files stay DOM-free (verified by `bun run check:engine`). `scripts/pregen.ts` is NOT under `src/engine/`, so it may use `node:fs` and `AbortController`.

---

## Task 1: Candidate-grid model

**Files:**
- Create: `src/engine/puzzles/sudoku/candidates.ts`
- Test: `tests/engine/puzzles/sudoku/candidates.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/puzzles/sudoku/candidates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { UNITS, ROWS, COLS, BOXES, PEERS, computeCandidates } from '../../../../src/engine/puzzles/sudoku/candidates';
import { gridFromString } from '../../../../src/engine/puzzles/sudoku/rules';

describe('candidates model', () => {
  it('has 27 units of 9 cells each', () => {
    expect(UNITS.length).toBe(27);
    expect(UNITS.every((u) => u.length === 9)).toBe(true);
    expect(ROWS.length).toBe(9);
    expect(COLS.length).toBe(9);
    expect(BOXES.length).toBe(9);
  });

  it('row/col/box membership is correct', () => {
    expect(ROWS[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(COLS[0]).toEqual([0, 9, 18, 27, 36, 45, 54, 63, 72]);
    expect(BOXES[0]).toEqual([0, 1, 2, 9, 10, 11, 18, 19, 20]);
  });

  it('each cell has 20 distinct peers, excluding itself', () => {
    expect(PEERS.length).toBe(81);
    expect(PEERS.every((p) => p.length === 20)).toBe(true);
    expect(PEERS[0]).not.toContain(0);
    // cell 0 peers include its row, col, box neighbours
    expect(PEERS[0]).toEqual(expect.arrayContaining([1, 9, 10, 8, 72]));
  });

  it('computeCandidates: filled cell yields a singleton set', () => {
    const grid = gridFromString('5' + '0'.repeat(80));
    expect([...computeCandidates(grid)[0]]).toEqual([5]);
  });

  it('computeCandidates: empty cell excludes peer digits', () => {
    // place 1 in cell 1 and 2 in cell 9 (both peers of cell 0); cell 0 cannot be 1 or 2
    const g = new Array(81).fill(0);
    g[1] = 1; g[9] = 2;
    const c0 = computeCandidates(g)[0];
    expect(c0.has(1)).toBe(false);
    expect(c0.has(2)).toBe(false);
    expect(c0.has(3)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- candidates`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement the candidates model**

Create `src/engine/puzzles/sudoku/candidates.ts`:
```ts
/** Sudoku unit/peer topology + candidate computation. Pure, no randomness. */

function buildUnits(): number[][] {
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) units.push([...Array(9)].map((_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) units.push([...Array(9)].map((_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3;
    const bc = (b % 3) * 3;
    const cells: number[] = [];
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) cells.push((br + dr) * 9 + (bc + dc));
    units.push(cells);
  }
  return units;
}

export const UNITS: number[][] = buildUnits();
export const ROWS: number[][] = UNITS.slice(0, 9);
export const COLS: number[][] = UNITS.slice(9, 18);
export const BOXES: number[][] = UNITS.slice(18, 27);

export const PEERS: number[][] = [...Array(81)].map((_, i) => {
  const set = new Set<number>();
  for (const u of UNITS) {
    if (u.includes(i)) for (const j of u) if (j !== i) set.add(j);
  }
  return [...set];
});

export type Candidates = Set<number>[];

/** For each cell: a singleton if filled, else the digits not used by any filled peer. */
export function computeCandidates(grid: number[]): Candidates {
  return grid.map((v, i) => {
    if (v !== 0) return new Set<number>([v]);
    const used = new Set<number>();
    for (const p of PEERS[i]) if (grid[p] !== 0) used.add(grid[p]);
    const s = new Set<number>();
    for (let d = 1; d <= 9; d++) if (!used.has(d)) s.add(d);
    return s;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- candidates`
Expected: PASS.

- [ ] **Step 5: Engine purity + lint**

Run: `bun run check:engine` (exit 0), `bun run lint` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/sudoku/candidates.ts tests/engine/puzzles/sudoku/candidates.test.ts
git commit -m "feat(sudoku): candidate-grid model (units, peers, computeCandidates)"
```

---

## Task 2: Singles techniques

**Files:**
- Create: `src/engine/puzzles/sudoku/techniques.ts`
- Test: `tests/engine/puzzles/sudoku/techniques.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/puzzles/sudoku/techniques.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { nakedSingle, hiddenSingle } from '../../../../src/engine/puzzles/sudoku/techniques';
import { computeCandidates } from '../../../../src/engine/puzzles/sudoku/candidates';

describe('singles techniques', () => {
  it('nakedSingle finds a cell with one candidate', () => {
    const grid = new Array(81).fill(0);
    // fill cell 0's peers with 1..8 so only 9 remains: peers row0 c1..c8 = 1..8
    [1, 2, 3, 4, 5, 6, 7, 8].forEach((d, k) => { grid[1 + k] = d; });
    const cand = computeCandidates(grid);
    const step = nakedSingle(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.placements).toEqual([{ index: 0, digit: 9 }]);
  });

  it('nakedSingle returns null when no singleton empty cell exists', () => {
    const grid = new Array(81).fill(0);
    const cand = computeCandidates(grid); // all cells have 9 candidates
    expect(nakedSingle(grid, cand)).toBeNull();
  });

  it('hiddenSingle finds the only spot for a digit in a unit', () => {
    const grid = new Array(81).fill(0);
    // Make digit 7 impossible everywhere in row 0 except cell 0:
    // put a 7 in the column or box of cells 1..8 of row 0.
    // cells 1..8 are columns 1..8; place 7 down each of those columns (row 1).
    for (let c = 1; c <= 8; c++) grid[9 + c] = 7; // row 1, cols 1..8 = 7
    const cand = computeCandidates(grid);
    const step = hiddenSingle(grid, cand);
    expect(step).not.toBeNull();
    // 7 in row 0 can only go in cell 0
    expect(step!.placements).toContainEqual({ index: 0, digit: 7 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- techniques`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement the singles + the Step type**

Create `src/engine/puzzles/sudoku/techniques.ts`:
```ts
import { UNITS, type Candidates } from './candidates';

export type TechniqueName = 'nakedSingle' | 'hiddenSingle' | 'lockedCandidates' | 'nakedPair';

export interface Step {
  technique: TechniqueName;
  placements: { index: number; digit: number }[];
  eliminations: { index: number; digit: number }[];
}

/** A cell with exactly one remaining candidate. */
export function nakedSingle(grid: number[], cand: Candidates): Step | null {
  for (let i = 0; i < 81; i++) {
    if (grid[i] === 0 && cand[i].size === 1) {
      const digit = [...cand[i]][0];
      return { technique: 'nakedSingle', placements: [{ index: i, digit }], eliminations: [] };
    }
  }
  return null;
}

/** A digit that can go in exactly one empty cell of some unit. */
export function hiddenSingle(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      if (unit.some((i) => grid[i] === d)) continue;
      const spots = unit.filter((i) => grid[i] === 0 && cand[i].has(d));
      if (spots.length === 1) {
        return { technique: 'hiddenSingle', placements: [{ index: spots[0], digit: d }], eliminations: [] };
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- techniques`
Expected: PASS.

- [ ] **Step 5: Engine purity + lint**

Run: `bun run check:engine` (exit 0), `bun run lint` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/sudoku/techniques.ts tests/engine/puzzles/sudoku/techniques.test.ts
git commit -m "feat(sudoku): Step type + naked/hidden single techniques"
```

---

## Task 3: Locked candidates + naked pair

**Files:**
- Modify: `src/engine/puzzles/sudoku/techniques.ts`
- Test: `tests/engine/puzzles/sudoku/techniques-advanced.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/puzzles/sudoku/techniques-advanced.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { lockedCandidates, nakedPair } from '../../../../src/engine/puzzles/sudoku/techniques';
import { computeCandidates } from '../../../../src/engine/puzzles/sudoku/candidates';

describe('advanced techniques', () => {
  it('lockedCandidates (pointing) eliminates a digit from a row outside the box', () => {
    // Box 0 (cells r0-2,c0-2). Force digit 4 in box 0 to only appear in row 0 (cells 0,1,2),
    // by placing 4 somewhere in rows 1 and 2 of box 0's columns elsewhere is complex;
    // instead block 4 from box0 rows 1,2 via their row content.
    const grid = new Array(81).fill(0);
    // Put 4 in row 1 and row 2 (outside box 0) so cells (1,*) and (2,*) of box0 can't be 4.
    grid[9 + 3] = 4;  // row 1, col 3 → row 1 cannot have another 4 → box0 row1 cells lose 4
    grid[18 + 4] = 4; // row 2, col 4 → row 2 cannot have another 4 → box0 row2 cells lose 4
    const cand = computeCandidates(grid);
    const step = lockedCandidates(grid, cand);
    expect(step).not.toBeNull();
    // 4 in box 0 is now confined to row 0 → eliminate 4 from rest of row 0 (cells 3..8)
    expect(step!.eliminations.every((e) => e.digit === 4)).toBe(true);
    expect(step!.eliminations.some((e) => e.index >= 3 && e.index <= 8)).toBe(true);
  });

  it('nakedPair eliminates the pair digits from the rest of a unit', () => {
    const grid = new Array(81).fill(0);
    // In row 0, force cells 0 and 1 to both be exactly {1,2}:
    // remove 3..9 from cells 0 and 1 by placing them in their columns.
    for (let d = 3; d <= 9; d++) {
      // place digit d in column (d-3) rows... we need cells 0 and 1 to lose 3..9.
      // cell 0 col 0; cell 1 col 1. Put 3..9 down col 0 and col 1 (rows 2..8).
      grid[(d - 1) * 9 + 0] = d; // col 0, row d-1 = d (rows 2..8 for d 3..9)
      grid[(d - 1) * 9 + 1] = d; // col 1, row d-1 = d
    }
    const cand = computeCandidates(grid);
    // cells 0,1 now have candidates {1,2}; the naked pair should eliminate 1,2 from rest of row 0
    const step = nakedPair(grid, cand);
    expect(step).not.toBeNull();
    expect(step!.eliminations.every((e) => e.digit === 1 || e.digit === 2)).toBe(true);
    expect(step!.eliminations.some((e) => e.index >= 2 && e.index <= 8)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- techniques-advanced`
Expected: FAIL — `lockedCandidates`/`nakedPair` not exported.

- [ ] **Step 3: Append the techniques**

Append to `src/engine/puzzles/sudoku/techniques.ts` (add the import of `ROWS, COLS, BOXES` to the existing import line so it reads `import { UNITS, ROWS, COLS, BOXES, type Candidates } from './candidates';`):
```ts
function boxIndexOf(i: number): number {
  const r = Math.floor(i / 9);
  const c = i % 9;
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

/** Pointing (box→line) and claiming (line→box) eliminations. */
export function lockedCandidates(grid: number[], cand: Candidates): Step | null {
  // Pointing: candidates for d in a box confined to one row/col → eliminate from rest of that line.
  for (const box of BOXES) {
    for (let d = 1; d <= 9; d++) {
      if (box.some((i) => grid[i] === d)) continue;
      const spots = box.filter((i) => grid[i] === 0 && cand[i].has(d));
      if (spots.length < 2) continue;
      const rows = new Set(spots.map((i) => Math.floor(i / 9)));
      const cols = new Set(spots.map((i) => i % 9));
      if (rows.size === 1) {
        const r = [...rows][0];
        const elim = ROWS[r]
          .filter((i) => !box.includes(i) && grid[i] === 0 && cand[i].has(d))
          .map((i) => ({ index: i, digit: d }));
        if (elim.length) return { technique: 'lockedCandidates', placements: [], eliminations: elim };
      }
      if (cols.size === 1) {
        const c = [...cols][0];
        const elim = COLS[c]
          .filter((i) => !box.includes(i) && grid[i] === 0 && cand[i].has(d))
          .map((i) => ({ index: i, digit: d }));
        if (elim.length) return { technique: 'lockedCandidates', placements: [], eliminations: elim };
      }
    }
  }
  // Claiming: candidates for d in a row/col confined to one box → eliminate from rest of that box.
  for (const line of [...ROWS, ...COLS]) {
    for (let d = 1; d <= 9; d++) {
      if (line.some((i) => grid[i] === d)) continue;
      const spots = line.filter((i) => grid[i] === 0 && cand[i].has(d));
      if (spots.length < 2) continue;
      const boxes = new Set(spots.map(boxIndexOf));
      if (boxes.size === 1) {
        const b = [...boxes][0];
        const elim = BOXES[b]
          .filter((i) => !line.includes(i) && grid[i] === 0 && cand[i].has(d))
          .map((i) => ({ index: i, digit: d }));
        if (elim.length) return { technique: 'lockedCandidates', placements: [], eliminations: elim };
      }
    }
  }
  return null;
}

/** Two cells in a unit sharing the same two candidates → eliminate those digits elsewhere in the unit. */
export function nakedPair(grid: number[], cand: Candidates): Step | null {
  for (const unit of UNITS) {
    const empties = unit.filter((i) => grid[i] === 0 && cand[i].size === 2);
    for (let a = 0; a < empties.length; a++) {
      for (let b = a + 1; b < empties.length; b++) {
        const ia = empties[a];
        const ib = empties[b];
        const sa = [...cand[ia]].sort((x, y) => x - y).join();
        const sb = [...cand[ib]].sort((x, y) => x - y).join();
        if (sa !== sb) continue;
        const digits = [...cand[ia]];
        const elim: { index: number; digit: number }[] = [];
        for (const i of unit) {
          if (i === ia || i === ib || grid[i] !== 0) continue;
          for (const d of digits) if (cand[i].has(d)) elim.push({ index: i, digit: d });
        }
        if (elim.length) return { technique: 'nakedPair', placements: [], eliminations: elim };
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- techniques-advanced`
Expected: PASS. Also run `bun run test -- techniques` to confirm no regression.

- [ ] **Step 5: Engine purity + lint**

Run: `bun run check:engine` (exit 0), `bun run lint` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/sudoku/techniques.ts tests/engine/puzzles/sudoku/techniques-advanced.test.ts
git commit -m "feat(sudoku): locked candidates + naked pair techniques"
```

---

## Task 4: Technique solver + difficulty rater

**Files:**
- Create: `src/engine/puzzles/sudoku/rater.ts`
- Test: `tests/engine/puzzles/sudoku/rater.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/puzzles/sudoku/rater.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { solveWithTechniques, rate } from '../../../../src/engine/puzzles/sudoku/rater';
import { gridFromString } from '../../../../src/engine/puzzles/sudoku/rules';

const SOLUTION =
  '534678912' + '672195348' + '198342567' +
  '859761423' + '426853791' + '713924856' +
  '961537284' + '287419635' + '345286179';
// A classic easy puzzle solvable by singles alone:
const EASY =
  '53..7....' + '6..195...' + '.98....6.' +
  '8...6...3' + '4..8.3..1' + '7...2...6' +
  '.6....28.' + '...419..5' + '....8..79';

describe('technique solver + rater', () => {
  it('solveWithTechniques solves an already-complete grid', () => {
    const t = solveWithTechniques(gridFromString(SOLUTION));
    expect(t.solved).toBe(true);
  });

  it('solveWithTechniques solves the classic easy puzzle', () => {
    const t = solveWithTechniques(gridFromString(EASY));
    expect(t.solved).toBe(true);
  });

  it('rate returns a known difficulty band for the easy puzzle', () => {
    const band = rate({ givens: gridFromString(EASY) });
    expect(['easy', 'medium', 'hard']).toContain(band);
  });

  it('rate returns expert when the technique ladder cannot finish', () => {
    // an almost-empty grid is unique-unsolvable by our ladder → expert
    const band = rate({ givens: gridFromString('1' + '0'.repeat(80)) });
    expect(band).toBe('expert');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- rater`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement the solver + rater**

Create `src/engine/puzzles/sudoku/rater.ts`:
```ts
import { computeCandidates, PEERS, type Candidates } from './candidates';
import { nakedSingle, hiddenSingle, lockedCandidates, nakedPair, type Step } from './techniques';
import type { Difficulty } from '../../core/types';
import type { SudokuInstance } from './types';

/** Ladder of techniques, easiest first, each with a difficulty rank. */
const LADDER: { fn: (g: number[], c: Candidates) => Step | null; rank: number }[] = [
  { fn: nakedSingle, rank: 1 },
  { fn: hiddenSingle, rank: 1 },
  { fn: lockedCandidates, rank: 2 },
  { fn: nakedPair, rank: 3 }
];

function apply(step: Step, grid: number[], cand: Candidates): void {
  for (const { index, digit } of step.placements) {
    grid[index] = digit;
    cand[index] = new Set<number>([digit]);
    for (const p of PEERS[index]) cand[p].delete(digit);
  }
  for (const { index, digit } of step.eliminations) cand[index].delete(digit);
}

export interface SolveTrace {
  solved: boolean;
  hardestRank: number;
}

/** Solve as far as the technique ladder allows; report whether solved + the hardest rank used. */
export function solveWithTechniques(givens: number[]): SolveTrace {
  const grid = [...givens];
  const cand = computeCandidates(grid);
  let hardestRank = 0;
  for (;;) {
    let progressed = false;
    for (const t of LADDER) {
      const step = t.fn(grid, cand);
      if (step) {
        apply(step, grid, cand);
        hardestRank = Math.max(hardestRank, t.rank);
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }
  return { solved: grid.every((v) => v !== 0), hardestRank };
}

/** Rate a puzzle by the hardest technique its solution path requires. */
export function rate(instance: SudokuInstance): Difficulty {
  const trace = solveWithTechniques(instance.givens);
  if (!trace.solved) return 'expert';
  if (trace.hardestRank <= 1) return 'easy';
  if (trace.hardestRank === 2) return 'medium';
  return 'hard';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- rater`
Expected: PASS.

- [ ] **Step 5: Engine purity + lint**

Run: `bun run check:engine` (exit 0), `bun run lint` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/sudoku/rater.ts tests/engine/puzzles/sudoku/rater.test.ts
git commit -m "feat(sudoku): technique solver + difficulty rater"
```

---

## Task 5: Hints

**Files:**
- Create: `src/engine/puzzles/sudoku/hint.ts`
- Test: `tests/engine/puzzles/sudoku/hint.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/puzzles/sudoku/hint.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getHint } from '../../../../src/engine/puzzles/sudoku/hint';
import { gridFromString } from '../../../../src/engine/puzzles/sudoku/rules';

const EASY =
  '53..7....' + '6..195...' + '.98....6.' +
  '8...6...3' + '4..8.3..1' + '7...2...6' +
  '.6....28.' + '...419..5' + '....8..79';

describe('getHint', () => {
  it('returns a next-step hint for a fresh easy puzzle', () => {
    const givens = gridFromString(EASY);
    const state = { cells: new Array(81).fill(0) };
    const hint = getHint({ givens }, state);
    expect(hint).not.toBeNull();
    expect(hint!.cells.length).toBeGreaterThan(0);
    expect(typeof hint!.text).toBe('string');
  });

  it('accounts for the player state (entries narrow the next hint)', () => {
    const givens = gridFromString(EASY);
    const state = { cells: new Array(81).fill(0) };
    // a hint should still be available mid-solve
    const hint = getHint({ givens }, state);
    expect(hint).not.toBeNull();
  });

  it('returns null on an already-solved grid', () => {
    const solved =
      '534678912' + '672195348' + '198342567' +
      '859761423' + '426853791' + '713924856' +
      '961537284' + '287419635' + '345286179';
    const givens = gridFromString(solved);
    const hint = getHint({ givens }, { cells: new Array(81).fill(0) });
    expect(hint).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- hint`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement getHint**

Create `src/engine/puzzles/sudoku/hint.ts`:
```ts
import { computeCandidates } from './candidates';
import { nakedSingle, hiddenSingle, lockedCandidates, nakedPair, type TechniqueName } from './techniques';
import type { SudokuInstance, SudokuState } from './types';
import type { Hint } from '../../core/types';

const ORDER = [nakedSingle, hiddenSingle, lockedCandidates, nakedPair];
const LABEL: Record<TechniqueName, string> = {
  nakedSingle: 'Naked single',
  hiddenSingle: 'Hidden single',
  lockedCandidates: 'Locked candidates',
  nakedPair: 'Naked pair'
};

/**
 * Suggest the next logical step given the current play state.
 * Working grid = givens overlaid with the player's entries.
 */
export function getHint(instance: SudokuInstance, state: SudokuState): Hint | null {
  const grid = instance.givens.map((g, i) => (g !== 0 ? g : state.cells[i] || 0));
  const cand = computeCandidates(grid);
  for (const fn of ORDER) {
    const step = fn(grid, cand);
    if (!step) continue;
    if (step.placements.length) {
      const p = step.placements[0];
      return { cells: [p.index], text: `${LABEL[step.technique]}: place ${p.digit}` };
    }
    return {
      cells: step.eliminations.map((e) => e.index),
      text: `${LABEL[step.technique]}: removes candidates`
    };
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- hint`
Expected: PASS.

- [ ] **Step 5: Engine purity + lint**

Run: `bun run check:engine` (exit 0), `bun run lint` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/sudoku/hint.ts tests/engine/puzzles/sudoku/hint.test.ts
git commit -m "feat(sudoku): getHint (next technique step from play state)"
```

---

## Task 6: Clue-digging generator

**Files:**
- Create: `src/engine/puzzles/sudoku/generator.ts`
- Test: `tests/engine/puzzles/sudoku/generator.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/puzzles/sudoku/generator.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateForDifficulty } from '../../../../src/engine/puzzles/sudoku/generator';
import { solveComplete } from '../../../../src/engine/puzzles/sudoku/solver';
import { gridToString } from '../../../../src/engine/puzzles/sudoku/rules';
import { rate } from '../../../../src/engine/puzzles/sudoku/rater';
import { createPrng } from '../../../../src/engine/core/prng';

describe('generateForDifficulty', () => {
  it('produces a puzzle whose givens are a subset of the solution', () => {
    const g = generateForDifficulty(createPrng('gen-1'), 'easy');
    expect(g.solution.length).toBe(81);
    for (let i = 0; i < 81; i++) {
      if (g.givens[i] !== 0) expect(g.givens[i]).toBe(g.solution[i]);
    }
  });

  it('produces a uniquely-solvable puzzle', () => {
    const g = generateForDifficulty(createPrng('gen-2'), 'medium');
    expect(solveComplete({ givens: g.givens }, 2).count).toBe(1);
  });

  it('the reported difficulty matches rate() of the givens', () => {
    const g = generateForDifficulty(createPrng('gen-3'), 'easy');
    expect(g.difficulty).toBe(rate({ givens: g.givens }));
  });

  it('an easy target does not exceed easy difficulty', () => {
    const g = generateForDifficulty(createPrng('gen-4'), 'easy');
    expect(g.difficulty).toBe('easy');
  });

  it('is deterministic for a seed', () => {
    const a = generateForDifficulty(createPrng('same-seed'), 'medium');
    const b = generateForDifficulty(createPrng('same-seed'), 'medium');
    expect(gridToString(a.givens)).toBe(gridToString(b.givens));
  });

  it('digs out a meaningful number of cells (puzzle is not nearly full)', () => {
    const g = generateForDifficulty(createPrng('gen-5'), 'hard');
    const givenCount = g.givens.filter((v) => v !== 0).length;
    expect(givenCount).toBeLessThan(60);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- generator`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement the generator**

Create `src/engine/puzzles/sudoku/generator.ts`:
```ts
import { generateFullGrid } from './fullgrid';
import { solveComplete } from './solver';
import { rate } from './rater';
import type { PRNG } from '../../core/prng';
import type { SudokuGrid } from './types';
import type { Difficulty } from '../../core/types';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

export interface GeneratedSudoku {
  givens: SudokuGrid;
  solution: SudokuGrid;
  difficulty: Difficulty;
}

/**
 * Generate a unique Sudoku by digging cells out of a full grid in PRNG order,
 * keeping a removal only if (a) the puzzle stays uniquely solvable and
 * (b) it does not push the difficulty above the target band.
 */
export function generateForDifficulty(prng: PRNG, target: Difficulty): GeneratedSudoku {
  const solution = generateFullGrid(prng);
  const givens = [...solution];
  const order = prng.shuffle([...Array(81)].map((_, i) => i));
  for (const i of order) {
    const saved = givens[i];
    givens[i] = 0;
    if (solveComplete({ givens }, 2).count !== 1) {
      givens[i] = saved;
      continue;
    }
    if (RANK[rate({ givens })] > RANK[target]) {
      givens[i] = saved;
    }
  }
  return { givens, solution, difficulty: rate({ givens }) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- generator`
Expected: PASS. (Generation runs the solver ~160 times per puzzle; the suite should still complete in a couple of seconds.)

- [ ] **Step 5: Full suite + engine + lint**

Run: `bun run test` (all pass), `bun run check:engine` (exit 0), `bun run lint` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/sudoku/generator.ts tests/engine/puzzles/sudoku/generator.test.ts
git commit -m "feat(sudoku): clue-digging generator with difficulty cap"
```

---

## Task 7: Assemble the Sudoku module

**Files:**
- Create: `src/engine/puzzles/sudoku/index.ts`
- Test: `tests/engine/puzzles/sudoku/module.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/puzzles/sudoku/module.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sudoku } from '../../../../src/engine/puzzles/sudoku/index';
import { gridFromString, gridToString } from '../../../../src/engine/puzzles/sudoku/rules';
import { createPrng } from '../../../../src/engine/core/prng';

function freshSignal(): AbortSignal {
  return new AbortController().signal;
}

describe('sudoku module', () => {
  it('declares the deduction-puzzle shape', () => {
    expect(sudoku.type).toBe('sudoku');
    expect(sudoku.kind).toBe('deduction');
    expect(typeof sudoku.generate).toBe('function');
    expect(typeof sudoku.solveComplete).toBe('function');
    expect(typeof sudoku.rate).toBe('function');
    expect(typeof sudoku.getHint).toBe('function');
  });

  it('generate returns a unique puzzle with a matching solution', async () => {
    const res = await sudoku.generate({ difficulty: 'easy', prng: createPrng('mod-1'), signal: freshSignal() });
    expect(sudoku.solveComplete(res.instance, 2).count).toBe(1);
    // the solution solves the instance
    expect(gridToString(sudoku.solveComplete(res.instance, 1).solution!)).toBe(gridToString(res.solution!));
    expect(res.source).toBe('live');
  });

  it('generate is deterministic for a seed', async () => {
    const a = await sudoku.generate({ difficulty: 'medium', prng: createPrng('seed-x'), signal: freshSignal() });
    const b = await sudoku.generate({ difficulty: 'medium', prng: createPrng('seed-x'), signal: freshSignal() });
    expect(gridToString(a.instance.givens)).toBe(gridToString(b.instance.givens));
  });

  it('generate aborts when the signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      sudoku.generate({ difficulty: 'easy', prng: createPrng('abort'), signal: ctrl.signal })
    ).rejects.toThrow();
  });

  it('validateMove rejects edits to given cells and out-of-range values', () => {
    const givens = gridFromString('5' + '0'.repeat(80));
    const state = { cells: new Array(81).fill(0) };
    expect(sudoku.validateMove({ givens }, state, { index: 0, value: 3 }).ok).toBe(false); // given cell
    expect(sudoku.validateMove({ givens }, state, { index: 1, value: 10 }).ok).toBe(false); // bad value
    expect(sudoku.validateMove({ givens }, state, { index: 1, value: 7 }).ok).toBe(true);
    expect(sudoku.validateMove({ givens }, state, { index: 1, value: 0 }).ok).toBe(true); // clear
  });

  it('render exposes givens + cells for the UI', () => {
    const givens = gridFromString('5' + '0'.repeat(80));
    const state = { cells: new Array(81).fill(0) };
    const r = sudoku.render({ givens }, state) as { kind: string; givens: number[]; cells: number[] };
    expect(r.kind).toBe('grid9');
    expect(r.givens).toEqual(givens);
    expect(r.cells).toEqual(state.cells);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- sudoku/module`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement the module**

Create `src/engine/puzzles/sudoku/index.ts`:
```ts
import type {
  DeductionPuzzle,
  GenArgs,
  GenResult,
  SolveResult,
  MoveResult,
  RenderModel,
  Difficulty
} from '../../core/types';
import type { SudokuInstance, SudokuState, SudokuMove, SudokuSolution } from './types';
import { solveComplete as solve } from './solver';
import { rate as rateInstance } from './rater';
import { getHint as hint } from './hint';
import { generateForDifficulty, type GeneratedSudoku } from './generator';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };
const MAX_ATTEMPTS = 8;

function validateMove(instance: SudokuInstance, _state: SudokuState, move: SudokuMove): MoveResult {
  if (instance.givens[move.index] !== 0) return { ok: false, reason: 'cell is a given' };
  if (move.value !== 0 && (move.value < 1 || move.value > 9)) {
    return { ok: false, reason: 'value must be 1-9' };
  }
  return { ok: true };
}

function render(instance: SudokuInstance, state: SudokuState): RenderModel {
  return { kind: 'grid9', givens: instance.givens, cells: state.cells };
}

function closerTo(target: Difficulty, a: GeneratedSudoku, b: GeneratedSudoku): GeneratedSudoku {
  const da = Math.abs(RANK[a.difficulty] - RANK[target]);
  const db = Math.abs(RANK[b.difficulty] - RANK[target]);
  return db < da ? b : a;
}

export const sudoku: DeductionPuzzle<SudokuInstance, SudokuState, SudokuMove, SudokuSolution> = {
  type: 'sudoku',
  kind: 'deduction',

  async generate(args: GenArgs): Promise<GenResult<SudokuInstance, SudokuSolution>> {
    let closest: GeneratedSudoku | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (args.signal.aborted) throw new Error('generation aborted');
      const g = generateForDifficulty(args.prng, args.difficulty);
      if (g.difficulty === args.difficulty) {
        return { instance: { givens: g.givens }, solution: g.solution, achievedDifficulty: g.difficulty, source: 'live' };
      }
      closest = closest ? closerTo(args.difficulty, closest, g) : g;
    }
    return {
      instance: { givens: closest!.givens },
      solution: closest!.solution,
      achievedDifficulty: closest!.difficulty,
      source: 'live'
    };
  },

  solveComplete(instance: SudokuInstance, limit = 2): SolveResult<SudokuSolution> {
    return solve(instance, limit);
  },

  rate(instance: SudokuInstance): Difficulty {
    return rateInstance(instance);
  },

  getHint: hint,
  validateMove,
  render
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- sudoku/module`
Expected: PASS.

- [ ] **Step 5: Full suite + engine + lint**

Run: `bun run test` (all pass), `bun run check:engine` (exit 0), `bun run lint` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/sudoku/index.ts tests/engine/puzzles/sudoku/module.test.ts
git commit -m "feat(sudoku): assemble the DeductionPuzzle module"
```

---

## Task 8: Pre-generation build script

**Files:**
- Create: `scripts/pregen.ts`
- Test: `tests/scripts/pregen.test.ts`
- Modify: `package.json` (add a `pregen` script)

- [ ] **Step 1: Write the failing tests**

Create `tests/scripts/pregen.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildBundle, type PuzzleBundle } from '../../scripts/pregen';
import { gridFromString } from '../../src/engine/puzzles/sudoku/rules';
import { solveComplete } from '../../src/engine/puzzles/sudoku/solver';

describe('pregen buildBundle', () => {
  it('produces a versioned bundle with puzzles for every difficulty', async () => {
    const bundle: PuzzleBundle = await buildBundle(1);
    expect(bundle.engineVersion).toBe(1);
    expect(bundle.puzzles.length).toBeGreaterThan(0);
    const difficulties = new Set(bundle.puzzles.map((p) => p.requested));
    expect(difficulties).toEqual(new Set(['easy', 'medium', 'hard', 'expert']));
  });

  it('every bundled puzzle is uniquely solvable to its stored solution', async () => {
    const bundle = await buildBundle(1);
    for (const p of bundle.puzzles) {
      const res = solveComplete({ givens: gridFromString(p.givens) }, 2);
      expect(res.count).toBe(1);
    }
  });

  it('is deterministic (same version → identical bundle)', async () => {
    const a = await buildBundle(1);
    const b = await buildBundle(1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- pregen`
Expected: FAIL — cannot resolve `scripts/pregen`.

- [ ] **Step 3: Implement the pregen script**

Create `scripts/pregen.ts` (this is a build script, NOT engine code — it may use `node:fs` and `AbortController`):
```ts
import { sudoku } from '../src/engine/puzzles/sudoku/index';
import { createPrng, deriveSeed } from '../src/engine/core/prng';
import { DIFFICULTIES, type Difficulty } from '../src/engine/core/types';
import { gridToString } from '../src/engine/puzzles/sudoku/rules';

const PER_DIFFICULTY = 2;

export interface BundledPuzzle {
  type: 'sudoku';
  requested: Difficulty;
  achieved: Difficulty;
  givens: string;
  solution: string;
}

export interface PuzzleBundle {
  engineVersion: number;
  puzzles: BundledPuzzle[];
}

/** Build the fallback bundle deterministically from the engine version. */
export async function buildBundle(engineVersion: number): Promise<PuzzleBundle> {
  const puzzles: BundledPuzzle[] = [];
  for (const difficulty of DIFFICULTIES) {
    for (let n = 0; n < PER_DIFFICULTY; n++) {
      const prng = createPrng(deriveSeed('sudoku', difficulty, 'pregen', engineVersion, n));
      const signal = new AbortController().signal;
      const res = await sudoku.generate({ difficulty, prng, signal });
      puzzles.push({
        type: 'sudoku',
        requested: difficulty,
        achieved: res.achievedDifficulty,
        givens: gridToString(res.instance.givens),
        solution: gridToString(res.solution!)
      });
    }
  }
  return { engineVersion, puzzles };
}
```

Then append the file-writing entry point (only runs when executed directly, not when imported by tests):
```ts
if (import.meta.main) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const ENGINE_VERSION = 1;
  const bundle = await buildBundle(ENGINE_VERSION);
  mkdirSync('static', { recursive: true });
  writeFileSync('static/puzzles.bundle.json', JSON.stringify(bundle));
  // eslint-disable-next-line no-console
  console.log(`wrote ${bundle.puzzles.length} puzzles to static/puzzles.bundle.json`);
}
```
(`import.meta.main` is true under Bun only when the file is the entry point.)

- [ ] **Step 4: Add the `pregen` script to `package.json`**

In `package.json` `"scripts"`, add:
```json
    "pregen": "bun run scripts/pregen.ts",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- pregen`
Expected: PASS. Then verify the entry point actually writes the file:
```bash
bun run pregen
```
Expected: prints "wrote N puzzles…" and creates `static/puzzles.bundle.json`. (Note: `static/puzzles.bundle.json` is a generated artifact — it may be committed or gitignored per project preference; for now, do NOT commit the generated JSON, only the script. Add `static/puzzles.bundle.json` to `.gitignore`.)

- [ ] **Step 6: Gitignore the generated bundle**

Append to `.gitignore`:
```
static/puzzles.bundle.json
```

- [ ] **Step 7: Full suite + engine + lint**

Run: `bun run test` (all pass), `bun run check:engine` (exit 0), `bun run lint` (exit 0).

- [ ] **Step 8: Commit**

```bash
git add scripts/pregen.ts tests/scripts/pregen.test.ts package.json .gitignore
git commit -m "feat(sudoku): build-time pre-generation bundle script"
```

---

## Done criteria for Plan 2

- `bun run test` green; `bun run check:engine` exit 0; `bun run lint` clean.
- You can: generate a unique Sudoku at (or closest to) a target difficulty from a seed, rate any Sudoku's difficulty, get a next-step hint from a play state, and produce a deterministic fallback bundle.
- The `sudoku` module implements the full `DeductionPuzzle` interface — ready for Plan 3 (worker + UI) to consume.

---

## Self-review notes

- **Spec coverage:** clue-digging generator + uniqueness recheck (§4.1) → Task 6; per-type human-technique rater, separate from the oracle (§3.3) → Tasks 2–4; `getHint` (§3.2, §10 Phase 1) → Task 5; pregen fallback bundle as a build artifact (§4, §10) → Task 8; full `DeductionPuzzle` assembly (§3.2) → Task 7; difficulty band contract consumed (§3.2) → Tasks 4, 6, 7.
- **Type consistency:** `GeneratedSudoku` defined in Task 6, consumed in Task 7; `SudokuInstance`/`SudokuState`/`SudokuMove`/`SudokuSolution` from Plan 1; `Step`/`TechniqueName` defined in Task 2, extended in Task 3, consumed in Tasks 4–5; `rate`/`solveComplete`/`getHint` wired into the module in Task 7 matching the `DeductionPuzzle` signatures.
- **Deferred to Plan 3 (intentional):** worker protocol + fallback chain consumption of the bundle, Svelte UI, persistence, daily, share.
- **Note on rater determinism:** `rate` is deterministic (no randomness); the generator's randomness comes solely from the injected PRNG, preserving seed reproducibility.
