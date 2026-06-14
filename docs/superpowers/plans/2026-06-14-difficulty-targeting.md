# Reliable Difficulty Targeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Make every deduction puzzle (Sudoku, Tectonic, Kakuro) reliably generate at the requested difficulty band, with a metric that spans all four bands (easy/medium/hard/expert). Greco-Latin already targets exactly (reveal ratio) — leave it.

**Approach:** Replace the per-type, inconsistent technique raters (used for the difficulty *number*) with a single **search-effort** metric: a shared minimal solver that propagates forced (single-candidate) cells, then counts the *guesses* (branch attempts) needed to finish. Effort 0 = easy; small = medium; more = hard; lots = expert (per-type thresholds, calibrated). Each module supplies a `candidates(grid, i)` function (it already has the logic in its rater). Generators already loop "generate → keep if band matches → else closest" (Sudoku/Tectonic do; Kakuro gains the loop); with a band-spanning metric, that loop now actually hits targets. Technique solvers stay for **hints** (unchanged).

**Tech Stack:** TypeScript, Bun, Vitest.

---

## Task 1: shared effort metric + band mapping

**Files:** `src/engine/core/effort.ts`, `src/engine/core/difficulty.ts`; Test `tests/engine/core/effort.test.ts`

- [ ] **Step 1: Failing tests** — `tests/engine/core/effort.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { measureEffort, type EffortModel } from '../../../src/engine/core/effort';
import { bandFromEffort } from '../../../src/engine/core/difficulty';

// A trivial 1-D "Latin row" puzzle of length L: cells 0..L-1, each must be 1..L distinct.
function rowModel(L: number): EffortModel {
  return {
    cellCount: L,
    candidates(grid, i) {
      if (grid[i] !== 0) return [];
      const used = new Set(grid.filter((v) => v !== 0));
      const out: number[] = [];
      for (let v = 1; v <= L; v++) if (!used.has(v)) out.push(v);
      return out;
    }
  };
}

describe('measureEffort', () => {
  it('a fully-given grid needs zero guesses', () => {
    expect(measureEffort([1, 2, 3], rowModel(3))).toBe(0);
  });
  it('a grid solvable by forced singles needs zero guesses', () => {
    // [0,2,3] → cell 0 forced to 1
    expect(measureEffort([0, 2, 3], rowModel(3))).toBe(0);
  });
  it('an empty grid needs guesses (>0)', () => {
    // [0,0,0] → first cell has 3 candidates → must guess
    expect(measureEffort([0, 0, 0], rowModel(3))).toBeGreaterThan(0);
  });
  it('returns Infinity for an unsatisfiable grid', () => {
    // length 2 row with a repeated given is impossible to complete validly...
    // use a contradictory partial: both cells must be distinct but candidates run out
    const m = rowModel(2);
    // grid [0,0] with an extra constraint is hard to express here; instead test a 0-candidate cell:
    const bad: EffortModel = { cellCount: 1, candidates: () => [] };
    expect(measureEffort([0], bad)).toBe(Infinity);
  });
});

describe('bandFromEffort', () => {
  it('maps effort to bands', () => {
    expect(bandFromEffort(0, 2, 6)).toBe('easy');
    expect(bandFromEffort(1, 2, 6)).toBe('medium');
    expect(bandFromEffort(2, 2, 6)).toBe('medium');
    expect(bandFromEffort(5, 2, 6)).toBe('hard');
    expect(bandFromEffort(99, 2, 6)).toBe('expert');
    expect(bandFromEffort(Infinity, 2, 6)).toBe('expert');
  });
});
```

- [ ] **Step 2: Run** `bun run test -- effort` (FAIL).

- [ ] **Step 3: Implement** `src/engine/core/effort.ts`:
```ts
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
```

`src/engine/core/difficulty.ts`:
```ts
import type { Difficulty } from './types';

/** Map a search-effort count to a difficulty band. effort 0 ⇒ easy; ≤t1 ⇒ medium; ≤t2 ⇒ hard; else expert. */
export function bandFromEffort(effort: number, t1: number, t2: number): Difficulty {
  if (effort <= 0) return 'easy';
  if (effort <= t1) return 'medium';
  if (effort <= t2) return 'hard';
  return 'expert';
}
```

- [ ] **Step 4–6:** tests PASS, check:engine 0, lint 0. Commit `feat(engine): shared search-effort difficulty metric`.

---

## Task 2: Sudoku effort-based rate

**Files:** modify `src/engine/puzzles/sudoku/rater.ts`; Test update `tests/engine/puzzles/sudoku/rater.test.ts`

- [ ] **Step 1:** In `rater.ts`, add a Sudoku `EffortModel` and switch `rate` to effort. Keep `solveWithTechniques` (used by hints elsewhere — DO NOT remove). Add:
```ts
import { measureEffort, type EffortModel } from '../../core/effort';
import { bandFromEffort } from '../../core/difficulty';
import { PEERS } from './candidates';

// Sudoku candidates: digits 1-9 not used by a filled peer.
const sudokuEffortModel: EffortModel = {
  cellCount: 81,
  candidates(grid, i) {
    if (grid[i] !== 0) return [];
    const used = new Set<number>();
    for (const p of PEERS[i]) if (grid[p] !== 0) used.add(grid[p]);
    const out: number[] = [];
    for (let d = 1; d <= 9; d++) if (!used.has(d)) out.push(d);
    return out;
  }
};

// Thresholds calibrated in Task 5; start with placeholders, Task 5 will tune.
export const SUDOKU_T1 = 1;
export const SUDOKU_T2 = 8;

export function rate(instance: SudokuInstance): Difficulty {
  return bandFromEffort(measureEffort(instance.givens, sudokuEffortModel), SUDOKU_T1, SUDOKU_T2);
}
```
Remove the OLD technique-based `rate` body (replace it). Keep the LADDER/`solveWithTechniques` exports intact.

- [ ] **Step 2:** Update `tests/engine/puzzles/sudoku/rater.test.ts`: the EASY classic puzzle should rate `'easy'` (it's forced-single solvable) — assert `rate(EASY) === 'easy'`. The near-empty grid (`'1'+0*80`) should rate `'expert'`. Keep `solveWithTechniques` tests as-is (still solves). Replace any assertion that depended on the technique-rank rating with the effort-based expectation (easy puzzle → easy; near-empty → expert).

- [ ] **Step 3:** `bun run test -- sudoku/rater` (PASS), `bun run test` (the generator/module tests still pass — they call rate but only assert difficulty == rate(givens) consistency and uniqueness, which hold), check:engine 0, lint 0. If `sudoku/generator` or `sudoku/module` tests assert a SPECIFIC band that changed, adjust them to assert `g.difficulty === rate({givens})` consistency rather than a hardcoded band. Commit `feat(sudoku): effort-based difficulty rating`.

---

## Task 3: Tectonic effort-based rate

**Files:** modify `src/engine/puzzles/tectonic/rater.ts`; Test update `tests/engine/puzzles/tectonic/rater.test.ts`

- [ ] **Step 1:** Add a Tectonic `EffortModel` reusing the candidate logic (region size + region peers + king neighbours) and switch `rate` to effort. Keep `solveWithTechniques` for hints. Add:
```ts
import { measureEffort, type EffortModel } from '../../core/effort';
import { bandFromEffort } from '../../core/difficulty';
// build the model from the instance (region sizes/peers + king neighbours)
function effortModel(inst: TectonicInstance): EffortModel {
  const sizes = regionSizes(inst);
  const byRegion = cellsByRegion(inst.regions);
  return {
    cellCount: inst.regions.length,
    candidates(grid, i) {
      if (grid[i] !== 0) return [];
      const size = sizes[inst.regions[i]];
      const banned = new Set<number>();
      for (const p of byRegion[inst.regions[i]]) if (grid[p] !== 0) banned.add(grid[p]);
      for (const k of kingNeighbors(i, inst.width, inst.height)) if (grid[k] !== 0) banned.add(grid[k]);
      const out: number[] = [];
      for (let d = 1; d <= size; d++) if (!banned.has(d)) out.push(d);
      return out;
    }
  };
}

export const TECTONIC_T1 = 1;
export const TECTONIC_T2 = 6;

export function rate(inst: TectonicInstance): Difficulty {
  return bandFromEffort(measureEffort(inst.givens, effortModel(inst)), TECTONIC_T1, TECTONIC_T2);
}
```
(Import `regionSizes`, `cellsByRegion`, `kingNeighbors` — already imported in rater.ts.)

- [ ] **Step 2:** Update `tests/engine/puzzles/tectonic/rater.test.ts`: a fully-given grid → `rate === 'easy'` (effort 0). Keep `solveWithTechniques` test. Determinism test stays.

- [ ] **Step 3:** `bun run test -- tectonic`, `bun run test`, check:engine 0, lint 0. Fix any tectonic generator/module test asserting a fixed band (assert consistency with `rate` instead). Commit `feat(tectonic): effort-based difficulty rating`.

---

## Task 4: Kakuro effort-based rate + generate-and-select loop

**Files:** modify `src/engine/puzzles/kakuro/rater.ts`, `src/engine/puzzles/kakuro/index.ts`; Test update `tests/engine/puzzles/kakuro/rater.test.ts`

- [ ] **Step 1:** In `rater.ts`, add a Kakuro `EffortModel` reusing the run-constraint candidate logic and switch `rate` to effort. Keep `propagationSolves`/existing helpers if used by hint; the rater's `candidate()`/`constraints()` can be reused to build the model. Add:
```ts
import { measureEffort, type EffortModel } from '../../core/effort';
import { bandFromEffort } from '../../core/difficulty';

function effortModel(inst: KakuroInstance): EffortModel {
  const { runs, cellRuns } = constraints(inst); // existing helper
  return {
    cellCount: inst.black.length,
    candidates(grid, i) {
      if (inst.black[i] || grid[i] !== 0) return [];
      const out: number[] = [];
      for (let v = 1; v <= 9; v++) if (candidate(grid, i, v, runs, cellRuns)) out.push(v);
      return out;
    }
  };
}

export const KAKURO_T1 = 1;
export const KAKURO_T2 = 8;

export function rate(inst: KakuroInstance): Difficulty {
  return bandFromEffort(measureEffort(inst.black.map((b, i) => (b ? 0 : 0)), effortModel(inst)), KAKURO_T1, KAKURO_T2);
}
```
NOTE: the starting grid for measureEffort is the puzzle's givens — but Kakuro has NO givens (all white cells empty). So the starting grid is all-zero (black cells also 0; the model returns [] for black cells so they're never filled and never block "solved"). IMPORTANT: `measureEffort`'s "solved" check treats a cell as done when `grid[i] !== 0`; black cells stay 0 forever, so they'd look "empty" with 0 candidates → `candidates` returns [] → the propagation loop sees a 0-candidate cell and returns false (unsolvable!). FIX: the EffortModel for Kakuro must treat black cells as NOT-empty. Two options: (a) seed the starting grid with a sentinel for black cells, or (b) make measureEffort skip cells the model declares non-empty. Cleanest: pass a starting grid where black cells are set to -1 (non-zero so measureEffort treats them as filled) and have `candidates` return [] for them (already does). Use:
```ts
export function rate(inst: KakuroInstance): Difficulty {
  const start = inst.black.map((b) => (b ? -1 : 0)); // black = -1 (treated as filled), white = 0
  return bandFromEffort(measureEffort(start, effortModel(inst)), KAKURO_T1, KAKURO_T2);
}
```
(`measureEffort` treats any `grid[i] !== 0` as filled, so -1 black cells are skipped; `candidates` returns [] for them anyway. Confirm measureEffort never tries to "fill" them — it only iterates empty (===0) cells. Good.)

- [ ] **Step 2:** In `src/engine/puzzles/kakuro/index.ts`, give `generate` a generate-and-select loop (it currently does a single attempt). Mirror the Sudoku/Tectonic module pattern:
```ts
const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };
const MAX_ATTEMPTS = 12;
// in generate:
let best: GeneratedKakuro | null = null;
for (let a = 0; a < MAX_ATTEMPTS; a++) {
  if (args.signal.aborted) throw new Error('generation aborted');
  const g = generateForDifficulty(args.prng, args.difficulty);
  if (g.difficulty === args.difficulty) return { instance: g.instance, solution: g.solution, achievedDifficulty: g.difficulty, source: 'live' };
  best = best ? (Math.abs(RANK[g.difficulty]-RANK[args.difficulty]) < Math.abs(RANK[best.difficulty]-RANK[args.difficulty]) ? g : best) : g;
}
return { instance: best!.instance, solution: best!.solution, achievedDifficulty: best!.difficulty, source: 'live' };
```
(Import `GeneratedKakuro` from generator.) Also: `generator.ts`'s `generateForDifficulty` calls `rate(inst)` for the returned difficulty — now effort-based — fine; no other change needed there (its topology loop already produces unique puzzles; difficulty is whatever effort yields).

- [ ] **Step 3:** Update `tests/engine/puzzles/kakuro/rater.test.ts`: the forced hand-built instance solves by forced singles → `rate === 'easy'`. Keep it simple — assert `rate(forced) === 'easy'` and that `rate` returns a valid band.

- [ ] **Step 4:** `bun run test -- kakuro`, `bun run test`, check:engine 0, lint 0. Commit `feat(kakuro): effort-based difficulty rating + generate-and-select`.

---

## Task 5: calibrate thresholds + verify the spread

**Files:** modify the `*_T1`/`*_T2` constants in the three raters; add `tests/engine/difficulty-distribution.test.ts`

- [ ] **Step 1:** Write a throwaway calibration script (run with `bun run`, do NOT commit it) that, for each deduction type, generates ~40 puzzles by digging MAXIMALLY (call the type's `generateForDifficulty(prng, 'expert', ...)` which digs hardest) and records `measureEffort` of each. Print the effort distribution (min, median, p75, p90, max) per type. Use it to choose `T1` (≈ the easy/medium boundary — effort just above 0, e.g. 1) and `T2` (≈ p75–p85 of the effort distribution, so 'hard' and 'expert' both occur). Update `SUDOKU_T1/T2`, `TECTONIC_T1/T2`, `KAKURO_T1/T2` accordingly. Delete the script.

- [ ] **Step 2:** Add `tests/engine/difficulty-distribution.test.ts` that asserts each deduction type's `module.generate` can produce EACH requested band (or its closest) and, importantly, that across the bands the achieved difficulties are MONOTONIC / spread (not all collapsing to one):
```ts
import { describe, it, expect } from 'vitest';
import { MODULES } from '../../src/engine/puzzles/registry';
import { createPrng } from '../../src/engine/core/prng';
import { DIFFICULTIES } from '../../src/engine/core/types';

function sig() { return new AbortController().signal; }

describe('difficulty targeting', () => {
  for (const type of ['sudoku', 'tectonic', 'kakuro'] as const) {
    it(`${type}: easy is easier than expert (achieved effort spread)`, async () => {
      const mod = MODULES[type]!;
      const easy = await mod.generate({ difficulty: 'easy', prng: createPrng(`${type}-easy`), signal: sig() });
      const expert = await mod.generate({ difficulty: 'expert', prng: createPrng(`${type}-expert`), signal: sig() });
      const rank = { easy: 1, medium: 2, hard: 3, expert: 4 } as const;
      // easy request should achieve a band no harder than the expert request
      expect(rank[easy.achievedDifficulty]).toBeLessThanOrEqual(rank[expert.achievedDifficulty]);
      // easy request should actually achieve 'easy'
      expect(easy.achievedDifficulty).toBe('easy');
    }, 30000);

    it(`${type}: hitsRequested for easy+medium within attempts`, async () => {
      const mod = MODULES[type]!;
      for (const d of ['easy', 'medium'] as const) {
        const r = await mod.generate({ difficulty: d, prng: createPrng(`${type}-${d}-x`), signal: sig() });
        expect(DIFFICULTIES).toContain(r.achievedDifficulty);
      }
    }, 30000);
  }
});
```
(Keep assertions ROBUST: 'easy' must be reliably achievable; the spread assertion uses easy ≤ expert. If after calibration a type cannot reliably hit 'hard' exactly, that's acceptable — assert spread + easy/medium, and note the limitation. Do NOT over-assert exact hard/expert if generation can't reliably reach them; instead assert the achieved difficulty for an 'expert' request ranks ≥ that of an 'easy' request.)

- [ ] **Step 3:** Run `bun run test` (all pass), `bun run check:engine` (0), `bun run lint` (0). Report the final thresholds and the observed distribution per type. Commit `feat(engine): calibrate difficulty thresholds + distribution test`.

---

## Task 6: full verification

- [ ] **Step 1:** `bun run test` (all pass — report count), `bun run check:engine` (0), `bun run lint` (0), `bun run pregen && bun run build` (ok), `bun run test:e2e` (all smokes pass — UI difficulty selectors still work; the displayed difficulty now reflects achieved band).
- [ ] **Step 2:** A short manual distribution probe (throwaway, not committed): for each deduction type, request each of the 4 bands a few times and print the achieved bands, confirming the spread is sensible and 'easy'/'medium' reliably hit. Report the table.
- [ ] **Step 3:** Commit nothing new (verification only) unless a fix was needed.

---

## Done criteria
- A single search-effort metric drives difficulty for all deduction types; `easy` and `medium` are reliably hit, and `hard`/`expert` requests reliably produce harder puzzles than `easy` (achieved band reported via `achievedDifficulty`). Greco-Latin unchanged (reveal-ratio). All tests + build + e2e green.

## Self-review notes
- This replaces the inconsistent technique-rank rating (Tectonic 3 bands, Kakuro 2) with a uniform 4-band effort metric, fixing the core targeting gap honestly. Technique solvers remain for hints.
- Effort = guesses by a forced-propagation+MRV solver; deterministic; 0 ⇒ forced-solvable (easy). Per-type thresholds calibrated empirically.
- Generate-and-select (already in Sudoku/Tectonic, added to Kakuro) + a band-spanning metric = reliable targeting for easy/medium; harder bands reported honestly via achievedDifficulty when not hit exactly.
