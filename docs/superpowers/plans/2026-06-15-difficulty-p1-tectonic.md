# Technique-Based Difficulty — P1 (Tectonic): Rater + Generation Floor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Tectonic onto the technique-based difficulty rater and the dig-to-minimal/relax generation floor, so its `hard`/`expert` bands reflect real human deduction and actually reach players.

**Architecture:** Tectonic adopts the shared `technique-rating` framework (built in P0) with a **king-aware** ladder, since Tectonic has only region + 8-neighbour (king) adjacency constraints — no rows/columns. Generation switches to dig-to-minimal + relax-to-target (as Sudoku P4), and the module loop becomes exact-or-throw. The serving layer (bundle PER_DIFFICULTY=3, achieved-difficulty selection) was already hardened generically in P4 and needs no change.

**Tech Stack:** TypeScript (engine-pure: no DOM/Worker/Math.random/crypto), Vitest (`bun run test:unit`), Bun. Pre-commit fallow gate blocks dead exports + cognitive complexity >20 (no `fallow-ignore`).

**Spec correction (important):** Spec §5 listed Tectonic rank 3 as "locked candidates (region↔line)". Tectonic has **no lines** (`src/engine/puzzles/tectonic/rules.ts`: constraints are region-uniqueness + `kingNeighbors`). This plan replaces that with Tectonic-appropriate techniques. Corrected ladder: **1 naked single · 2 hidden single in region · 3 naked pair in region · 4 king-pointing** (a digit whose region-candidate cells are all king-adjacent to a cell X ⇒ X ≠ that digit). Band table: easy ≤1 · medium ≤2 · **hard ≤4** · expert = unsolved by this ladder. (Like Sudoku, "expert" is fully defined by unsolved-by-the-implemented-ladder, so ranks 3 and 4 are exactly what's needed — nothing beyond king-pointing is required for correct bands.)

---

## File Structure

- **Create** `src/engine/puzzles/tectonic/techniques.ts` — `TectonicCtx`, `makeCtx`, `isSolved`, and the four rank-tagged techniques (each mutates the ctx and returns whether it progressed) + small helpers. The single home of Tectonic deduction techniques.
- **Modify** `src/engine/puzzles/tectonic/rater.ts` — replace the bespoke `solveWithTechniques` loop and the effort-based `rate()` with the shared framework + the king-aware ladder + `bandForRank`.
- **Modify** `src/engine/puzzles/tectonic/generator.ts` — replace "dig to ≤ target" with dig-to-minimal + relax-to-target.
- **Modify** `src/engine/puzzles/tectonic/index.ts` — exact-band-or-throw generate loop (drop the closest-fallback).
- **Tests:** `tests/engine/puzzles/tectonic/techniques.test.ts` (new), `tests/engine/puzzles/tectonic/rater.test.ts`, `tests/engine/puzzles/tectonic/generator.test.ts` (new or modify), `tests/engine/puzzles/tectonic/module.test.ts` (new or modify).

---

### Task 1: Tectonic technique module (king-aware ladder)

**Files:**
- Create: `src/engine/puzzles/tectonic/techniques.ts`
- Test: `tests/engine/puzzles/tectonic/techniques.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine/puzzles/tectonic/techniques.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeCtx, nakedSingle, hiddenSingleRegion, nakedPairRegion, kingPointing } from '../../../../src/engine/puzzles/tectonic/techniques';
import type { TectonicInstance } from '../../../../src/engine/puzzles/tectonic/types';

// A 1x4 grid that is a single region of size 4 (digits 1..4). King-neighbours in a
// 1-row grid are just the horizontal neighbours.
const ONE_REGION_4: TectonicInstance = { width: 4, height: 1, regions: [0, 0, 0, 0], givens: [0, 0, 0, 0] };

describe('tectonic techniques', () => {
  it('nakedSingle places a forced cell', () => {
    const ctx = makeCtx(ONE_REGION_4);
    ctx.cand[0] = new Set([3]); // force cell 0 to 3
    expect(nakedSingle(ctx)).toBe(true);
    expect(ctx.grid[0]).toBe(3);
    // placing 3 in cell 0 removes 3 from region peers and king neighbours
    expect(ctx.cand[1].has(3)).toBe(false);
  });

  it('hiddenSingleRegion places a digit with one home in the region', () => {
    const ctx = makeCtx(ONE_REGION_4);
    // digit 4 can only live in cell 3
    ctx.cand[0] = new Set([1, 2]);
    ctx.cand[1] = new Set([1, 2]);
    ctx.cand[2] = new Set([1, 2, 3]);
    ctx.cand[3] = new Set([3, 4]);
    expect(hiddenSingleRegion(ctx)).toBe(true);
    expect(ctx.grid[3]).toBe(4);
  });

  it('nakedPairRegion clears the pair digits from the region’s other cells', () => {
    const ctx = makeCtx(ONE_REGION_4);
    ctx.cand[0] = new Set([1, 2]);
    ctx.cand[1] = new Set([1, 2]);
    ctx.cand[2] = new Set([1, 2, 3]);
    ctx.cand[3] = new Set([1, 2, 4]);
    expect(nakedPairRegion(ctx)).toBe(true);
    expect(ctx.cand[2].has(1)).toBe(false);
    expect(ctx.cand[2].has(2)).toBe(false);
    expect(ctx.cand[2].has(3)).toBe(true);
  });

  it('kingPointing eliminates a digit from a cell adjacent to all of a region’s candidate cells', () => {
    // 2x2 grid; region A = top row {0,1} (size 2, digits 1-2); cells 2,3 are their own
    // size-1 regions... use a layout where digit 1 in region A can only be in cells 0,1,
    // and cell 2 (bottom-left) is king-adjacent to both 0 and 1.
    const inst: TectonicInstance = { width: 2, height: 2, regions: [0, 0, 1, 2], givens: [0, 0, 0, 0] };
    const ctx = makeCtx(inst);
    // region 0 = cells {0,1}; digit 1 candidate in both 0 and 1.
    ctx.cand[0] = new Set([1, 2]);
    ctx.cand[1] = new Set([1, 2]);
    ctx.cand[2] = new Set([1]); // cell 2 is region 1 (size 1) → only digit 1; it is king-adjacent to 0 and 1
    expect(kingPointing(ctx)).toBe(true);
    expect(ctx.cand[2].has(1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/engine/puzzles/tectonic/techniques.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/engine/puzzles/tectonic/techniques.ts`:

```ts
import { regionSizes, cellsByRegion, kingNeighbors, cellCandidates } from './rules';
import type { TectonicInstance } from './types';

export interface TectonicCtx {
  inst: TectonicInstance;
  grid: number[];
  cand: Set<number>[];
  regionOf: number[];
  regionCells: Record<number, number[]>;
  kings: number[][];
}

/** Build a mutable solving context: grid copy + per-cell candidate sets + region/king topology. */
export function makeCtx(inst: TectonicInstance): TectonicCtx {
  const sizes = regionSizes(inst);
  const regionCells = cellsByRegion(inst.regions);
  const grid = [...inst.givens];
  const kings = inst.regions.map((_, i) => kingNeighbors(i, inst.width, inst.height));
  const cand = grid.map((v, i) =>
    v !== 0 ? new Set<number>([v]) : new Set<number>(cellCandidates(inst, grid, i, sizes, regionCells))
  );
  return { inst, grid, cand, regionOf: inst.regions, regionCells, kings };
}

export function isSolved(ctx: TectonicCtx): boolean {
  return ctx.grid.every((v) => v !== 0);
}

/** Place digit `d` in cell `i`, pruning it from region peers and king neighbours. */
function place(ctx: TectonicCtx, i: number, d: number): void {
  ctx.grid[i] = d;
  ctx.cand[i] = new Set<number>([d]);
  for (const p of ctx.regionCells[ctx.regionOf[i]]) if (p !== i) ctx.cand[p].delete(d);
  for (const k of ctx.kings[i]) ctx.cand[k].delete(d);
}

/** Sorted candidate signature, so two cells with the same pair compare equal. */
function candKey(set: Set<number>): string {
  return [...set].sort((a, b) => a - b).join();
}

/** Cells king-adjacent to EVERY cell in `spots` (intersection of their king-neighbour sets). */
function commonKingNeighbors(ctx: TectonicCtx, spots: number[]): number[] {
  let common = new Set<number>(ctx.kings[spots[0]]);
  for (let s = 1; s < spots.length; s++) {
    const ks = new Set<number>(ctx.kings[spots[s]]);
    common = new Set<number>([...common].filter((x) => ks.has(x)));
  }
  return [...common];
}

/** Rank 1: a cell with exactly one candidate. */
export function nakedSingle(ctx: TectonicCtx): boolean {
  for (let i = 0; i < ctx.grid.length; i++) {
    if (ctx.grid[i] === 0 && ctx.cand[i].size === 1) {
      place(ctx, i, [...ctx.cand[i]][0]);
      return true;
    }
  }
  return false;
}

/** Rank 2: a digit that fits in exactly one empty cell of a region. */
export function hiddenSingleRegion(ctx: TectonicCtx): boolean {
  for (const cells of Object.values(ctx.regionCells)) {
    for (let d = 1; d <= cells.length; d++) {
      if (cells.some((i) => ctx.grid[i] === d)) continue;
      const spots = cells.filter((i) => ctx.grid[i] === 0 && ctx.cand[i].has(d));
      if (spots.length === 1) {
        place(ctx, spots[0], d);
        return true;
      }
    }
  }
  return false;
}

/** Rank 3: two cells in a region sharing the same two candidates → clear those digits from the region's other cells. */
export function nakedPairRegion(ctx: TectonicCtx): boolean {
  for (const cells of Object.values(ctx.regionCells)) {
    const pairCells = cells.filter((i) => ctx.grid[i] === 0 && ctx.cand[i].size === 2);
    for (let a = 0; a < pairCells.length; a++) {
      for (let b = a + 1; b < pairCells.length; b++) {
        if (candKey(ctx.cand[pairCells[a]]) !== candKey(ctx.cand[pairCells[b]])) continue;
        const digits = [...ctx.cand[pairCells[a]]];
        let changed = false;
        for (const i of cells) {
          if (i === pairCells[a] || i === pairCells[b] || ctx.grid[i] !== 0) continue;
          for (const d of digits) if (ctx.cand[i].delete(d)) changed = true;
        }
        if (changed) return true;
      }
    }
  }
  return false;
}

/** Rank 4: if a digit's region-candidate cells are all king-adjacent to a cell X, X can't be that digit. */
export function kingPointing(ctx: TectonicCtx): boolean {
  for (const cells of Object.values(ctx.regionCells)) {
    for (let d = 1; d <= cells.length; d++) {
      if (cells.some((i) => ctx.grid[i] === d)) continue;
      const spots = cells.filter((i) => ctx.grid[i] === 0 && ctx.cand[i].has(d));
      if (spots.length < 2) continue;
      let changed = false;
      for (const x of commonKingNeighbors(ctx, spots)) {
        if (ctx.grid[x] === 0 && !spots.includes(x) && ctx.cand[x].delete(d)) changed = true;
      }
      if (changed) return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/engine/puzzles/tectonic/techniques.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Purity + complexity checks**

Run: `bun run check:engine && bun run lint`
Expected: clean. If the fallow gate flags any technique's cognitive complexity, STOP and report the exact output (the helpers `candKey`/`commonKingNeighbors`/`place` are factored to keep each function small; do not add a suppression).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/tectonic/techniques.ts tests/engine/puzzles/tectonic/techniques.test.ts
git commit -m "feat(tectonic): king-aware technique ladder (singles, hidden single, naked pair, king-pointing)"
```

---

### Task 2: Flip the Tectonic rater onto the shared framework

**Files:**
- Modify: `src/engine/puzzles/tectonic/rater.ts`
- Test: `tests/engine/puzzles/tectonic/rater.test.ts`

- [ ] **Step 1: Update the rater test**

Replace `tests/engine/puzzles/tectonic/rater.test.ts` with (keeps the `solvableFull` helper; updates expectations to the technique bands):

```ts
import { describe, it, expect } from 'vitest';
import { rate, solveWithTechniques } from '../../../../src/engine/puzzles/tectonic/rater';
import { fill, solveComplete } from '../../../../src/engine/puzzles/tectonic/solver';
import { generateRegions } from '../../../../src/engine/puzzles/tectonic/regions';
import { createPrng } from '../../../../src/engine/core/prng';
import type { TectonicInstance } from '../../../../src/engine/puzzles/tectonic/types';

/** Build a solvable, fully-given 5x5 tectonic by retrying layouts. */
function solvableFull(): TectonicInstance {
  for (let k = 0; k < 500; k++) {
    const regions = generateRegions(5, 5, createPrng(k));
    for (let fk = 0; fk < 10; fk++) {
      const sol = fill({ width: 5, height: 5, regions, givens: new Array(25).fill(0) }, createPrng(k * 1000 + fk));
      if (sol) return { width: 5, height: 5, regions, givens: sol };
    }
  }
  throw new Error('no solvable layout found in 5000 tries');
}

describe('tectonic rater', () => {
  it('a fully-given grid solves with techniques and rates easy', () => {
    const inst = solvableFull();
    expect(solveWithTechniques(inst).solved).toBe(true);
    expect(rate(inst)).toBe('easy');
  });

  it('a grid the ladder cannot crack rates expert', () => {
    // An empty-givens 5x5 (regions only) is wildly non-unique → the ladder makes no
    // progress on most cells → unsolved → expert.
    const base = solvableFull();
    const empty: TectonicInstance = { ...base, givens: new Array(25).fill(0) };
    expect(rate(empty)).toBe('expert');
  });

  it('rate is deterministic', () => {
    const inst = solvableFull();
    expect(rate(inst)).toBe(rate(inst));
  });

  it('the technique solver never contradicts the unique solution of a uniquely-solvable instance', () => {
    const inst = solvableFull(); // fully given → unique
    expect(solveComplete(inst, 2).count).toBe(1);
    expect(solveWithTechniques(inst).solved).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `bun run test:unit tests/engine/puzzles/tectonic/rater.test.ts`
Expected: FAIL — the new "expert" assertion fails under the current effort-based `rate()`, and/or `solveWithTechniques` return shape differs.

- [ ] **Step 3: Rewrite the rater**

Replace the entire contents of `src/engine/puzzles/tectonic/rater.ts` with:

```ts
import {
  makeCtx,
  isSolved,
  nakedSingle,
  hiddenSingleRegion,
  nakedPairRegion,
  kingPointing,
  type TectonicCtx
} from './techniques';
import type { TectonicInstance } from './types';
import type { Difficulty } from '../../core/types';
import {
  rateByTechniques,
  solveByTechniques,
  type Technique,
  type TechniqueRater,
  type TechniqueTrace
} from '../../core/technique-rating';

// Ranks: naked single 1, hidden single 2, naked pair 3, king-pointing 4.
// Tectonic has no rows/columns — techniques use region-uniqueness + king adjacency.
const LADDER: Technique<TectonicCtx>[] = [
  { name: 'nakedSingle', rank: 1, apply: nakedSingle },
  { name: 'hiddenSingleRegion', rank: 2, apply: hiddenSingleRegion },
  { name: 'nakedPairRegion', rank: 3, apply: nakedPairRegion },
  { name: 'kingPointing', rank: 4, apply: kingPointing }
];

function bandForRank(rank: number): Difficulty {
  if (rank <= 1) return 'easy';
  if (rank <= 2) return 'medium';
  if (rank <= 4) return 'hard';
  return 'expert';
}

const tectonicRater: TechniqueRater<TectonicCtx> = {
  ladder: LADDER,
  isSolved,
  bandForRank,
  topRankStepThreshold: 3
};

/** Solve as far as the technique ladder allows; report solved + hardest rank + steps at that rank. */
export function solveWithTechniques(inst: TectonicInstance): TechniqueTrace {
  return solveByTechniques(makeCtx(inst), LADDER, isSolved);
}

/** Rate a Tectonic by the hardest king-aware technique it requires (unsolved by ladder ⇒ expert). */
export function rate(inst: TectonicInstance): Difficulty {
  return rateByTechniques(tectonicRater, () => makeCtx(inst));
}
```

- [ ] **Step 4: Run the rater test, expect pass**

Run: `bun run test:unit tests/engine/puzzles/tectonic/rater.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Engine + whole suite + lint**

Run: `bun run check:engine && bun run test:unit && bun run lint`
Expected: clean/green. `tectonic/hint.ts` only uses `cellCandidates` (naked single) — it does not import the rater, so it is unaffected. If any other tectonic test asserted old effort bands, update it to the technique bands (keep coverage). The old effort imports (`measureEffort`, `bandFromEffort`, `EffortModel`) are gone from the rater — confirm no leftover unused imports (fallow blocks them). `measureEffort`/`bandFromEffort` remain used by kakuro/yakuso, so do not delete the core modules.

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/tectonic/rater.ts tests/engine/puzzles/tectonic/rater.test.ts
git commit -m "feat(tectonic): technique-based rate() on shared framework"
```

---

### Task 3: Generation floor + exact-band module loop

**Files:**
- Modify: `src/engine/puzzles/tectonic/generator.ts`
- Modify: `src/engine/puzzles/tectonic/index.ts`
- Test: `tests/engine/puzzles/tectonic/generator.test.ts` (create), `tests/engine/puzzles/tectonic/module.test.ts` (create)

- [ ] **Step 1: Write the failing generator test**

Create `tests/engine/puzzles/tectonic/generator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateForDifficulty } from '../../../../src/engine/puzzles/tectonic/generator';
import { rate } from '../../../../src/engine/puzzles/tectonic/rater';
import { solveComplete } from '../../../../src/engine/puzzles/tectonic/solver';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import { DIFFICULTIES, type Difficulty } from '../../../../src/engine/core/types';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

describe('tectonic generateForDifficulty (dig-to-minimal + relax)', () => {
  it('never overshoots the target band and stays uniquely solvable', () => {
    for (const target of DIFFICULTIES) {
      for (let s = 0; s < 4; s++) {
        const g = generateForDifficulty(createPrng(deriveSeed('tectonic', target, 'overshoot', s)), target);
        expect(RANK[g.difficulty]).toBeLessThanOrEqual(RANK[target]);
        expect(g.difficulty).toBe(rate(g.instance));
        expect(solveComplete(g.instance, 2).count).toBe(1);
      }
    }
  });

  it('reaches each target band within a seed batch', () => {
    for (const target of DIFFICULTIES) {
      let hit = false;
      for (let s = 0; s < 30 && !hit; s++) {
        if (generateForDifficulty(createPrng(deriveSeed('tectonic', target, 'reach', s)), target).difficulty === target) {
          hit = true;
        }
      }
      expect(hit, `target ${target} should be reachable`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it, expect failure/flakiness**

Run: `bun run test:unit tests/engine/puzzles/tectonic/generator.test.ts`
Expected: FAIL/flaky under the old "dig to ≤ target" generator.

- [ ] **Step 3: Rewrite the generator's dig**

In `src/engine/puzzles/tectonic/generator.ts`, keep the region-layout fill loop (it produces `regions` + `solution`). Replace ONLY the clue-digging section (the `const givens = [...solution]; const order = ...; for (...) {...}` block and the final return) with dig-to-minimal + relax:

```ts
  const minimal = digToMinimal(prng, { width, height, regions }, solution);
  const givens = relaxToTarget(prng, { width, height, regions }, minimal, solution, target);
  const instance = { width, height, regions, givens };
  return { instance, solution, difficulty: rate(instance) };
```

And add these two module-private helpers (above `generateForDifficulty`), plus keep the existing `RANK`:

```ts
type Layout = { width: number; height: number; regions: number[] };

/** Remove every clue whose removal preserves a unique solution → the hardest minimal form. */
function digToMinimal(prng: PRNG, layout: Layout, solution: number[]): number[] {
  const givens = [...solution];
  for (const i of prng.shuffle(givens.map((_, k) => k))) {
    const saved = givens[i];
    givens[i] = 0;
    if (solveComplete({ ...layout, givens }, 2).count !== 1) givens[i] = saved;
  }
  return givens;
}

/** Add clues back (PRNG order) until the band drops to <= target; terminates (full solution rates easy). */
function relaxToTarget(prng: PRNG, layout: Layout, minimal: number[], solution: number[], target: Difficulty): number[] {
  const givens = [...minimal];
  if (RANK[rate({ ...layout, givens })] <= RANK[target]) return givens;
  for (const i of prng.shuffle(givens.map((_, k) => k).filter((k) => givens[k] === 0))) {
    givens[i] = solution[i];
    if (RANK[rate({ ...layout, givens })] <= RANK[target]) break;
  }
  return givens;
}
```

Ensure `solveComplete` and `rate` are already imported (they are). `PRNG` type import is already present.

- [ ] **Step 4: Run generator test, expect pass**

Run: `bun run test:unit tests/engine/puzzles/tectonic/generator.test.ts`
Expected: PASS. If "reaches each target band" fails for a band within 30 seeds, raise to 50 and re-run; if still failing, STOP and report (it signals the band cuts need revisiting for Tectonic — escalate, don't weaken the assertion).

- [ ] **Step 5: Write the module exact-or-throw test**

Create `tests/engine/puzzles/tectonic/module.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tectonic } from '../../../../src/engine/puzzles/tectonic';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import { DIFFICULTIES } from '../../../../src/engine/core/types';

describe('tectonic module generate', () => {
  it('returns an exactly in-band puzzle or throws — never a silent downgrade', async () => {
    for (const difficulty of DIFFICULTIES) {
      let got: string | null = null;
      for (let s = 0; s < 6 && got === null; s++) {
        const prng = createPrng(deriveSeed('tectonic', difficulty, 'module', s));
        try {
          const res = await tectonic.generate({ difficulty, prng, signal: new AbortController().signal });
          expect(res.achievedDifficulty).toBe(difficulty);
          got = res.achievedDifficulty;
        } catch {
          /* this prng missed; try the next */
        }
      }
      expect(got, `exact ${difficulty} within 6 seeds`).toBe(difficulty);
    }
  });
});
```

- [ ] **Step 6: Rewrite the module generate loop (throw on miss)**

In `src/engine/puzzles/tectonic/index.ts`:
(a) Delete the local `RANK` constant and the `closer` helper.
(b) Change `const MAX_ATTEMPTS = 6;` to `const MAX_ATTEMPTS = 60;`.
(c) Replace the whole `async generate(...)` body with:

```ts
  async generate(args: GenArgs): Promise<GenResult<TectonicInstance, TectonicSolution>> {
    for (let a = 0; a < MAX_ATTEMPTS; a++) {
      if (args.signal.aborted) throw new Error('generation aborted');
      let g;
      try {
        g = generateForDifficulty(args.prng, args.difficulty);
      } catch {
        continue; // region-layout fill occasionally fails; try again
      }
      if (g.difficulty === args.difficulty) {
        return { instance: g.instance, solution: g.solution, achievedDifficulty: g.difficulty, source: 'live' };
      }
    }
    throw new Error(`could not generate tectonic at ${args.difficulty} within ${MAX_ATTEMPTS} attempts`);
  },
```

(d) Remove the now-unused `GeneratedTectonic` import if it was only referenced by `closer`. Run `bun run lint` to confirm no dead code.

- [ ] **Step 7: Run module test + full suite**

Run: `bun run test:unit tests/engine/puzzles/tectonic/module.test.ts && bun run test:unit && bun run check:engine && bun run lint`
Expected: all green, no dead code. Fix any other tectonic test that assumed the old closest-fallback to the new exact-or-throw contract.

- [ ] **Step 8: Commit**

```bash
git add src/engine/puzzles/tectonic/generator.ts src/engine/puzzles/tectonic/index.ts tests/engine/puzzles/tectonic/generator.test.ts tests/engine/puzzles/tectonic/module.test.ts
git commit -m "feat(tectonic): dig-to-minimal + relax generation; exact-band-or-throw module loop"
```

---

### Task 4: End-to-end verification

**Files:** none (verification only); optional doc note.

- [ ] **Step 1: Measure Tectonic module reliability**

Run this one-off (delete the file after):

```bash
cd /home/sbrn/Projects/multilogic
cat > ./_tdist.ts <<'EOF'
import { tectonic } from './src/engine/puzzles/tectonic';
import { createPrng, deriveSeed } from './src/engine/core/prng';
import { DIFFICULTIES } from './src/engine/core/types';
const N = 15;
for (const target of DIFFICULTIES) {
  let ok = 0, threw = 0; const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    const prng = createPrng(deriveSeed('tectonic', target, 'verify', i));
    try { const r = await tectonic.generate({ difficulty: target, prng, signal: new AbortController().signal }); if (r.achievedDifficulty === target) ok++; }
    catch { threw++; }
  }
  console.log(`${target.padEnd(7)} exact=${((ok/N)*100).toFixed(0)}% threw=${((threw/N)*100).toFixed(0)}%  ${((performance.now()-t0)/N).toFixed(0)}ms/req`);
}
EOF
bun run ./_tdist.ts; rm -f ./_tdist.ts
```

Expected: every band `exact` high (ideally 100% with the 60-attempt loop); `threw` low. Record the numbers. If a band shows high `threw`, the in-band bundle covers it (pregen PER_DIFFICULTY=3 already builds 3 in-band tectonic puzzles via Task 3's throw-on-miss + pregen seed retries) — but note it for the calibration follow-up.

- [ ] **Step 2: Record the result in the spec**

Edit `docs/superpowers/specs/2026-06-15-technique-based-difficulty-design.md` §5/§6: add a short `### P1 result — Tectonic` note recording the corrected king-aware ladder (replacing the lines-based one) and the measured module reliability numbers.

- [ ] **Step 3: Regenerate the bundle (confirm Tectonic entries are in-band)**

Run: `bun run pregen` then:
```bash
node -e "const b=require('./static/puzzles.bundle.json'); const t=b.puzzles.filter(p=>p.type==='tectonic'); const bad=t.filter(p=>p.requested!==p.achieved); console.log(bad.length? 'OFF-BAND: '+JSON.stringify(bad.map(p=>({req:p.requested,got:p.achieved}))) : 'all '+t.length+' tectonic in-band: '+t.map(p=>p.achieved).join(','))"
```
Expected: `all 12 tectonic in-band` (3 per band) — because tectonic `generate()` now throws unless exact, pregen fills only in-band tectonic entries. If pregen throws for a tectonic band, STOP and report (calibration signal). (The bundle JSON is gitignored/built at deploy; nothing to commit here.)

- [ ] **Step 4: Final full verification + commit the doc note**

Run: `bun run test:unit && bun run check:engine && bun run lint`
Expected: all green.

```bash
git add docs/superpowers/specs/2026-06-15-technique-based-difficulty-design.md
git commit -m "docs(difficulty): record P1 Tectonic result"
```

---

## Self-Review

**Spec coverage (Tectonic rows of §5/§6/§9):**
- §5 Tectonic ladder + band table → Task 1 (techniques) + Task 2 (`bandForRank`, framework). Spec's "locked candidates (region↔line)" corrected to king-aware techniques — documented at top + Task 4 note.
- §4 no-phantom-expert → ladder reaches rank 4 (king-pointing); `bandForRank` references rank 4 as the hard ceiling; expert = unsolved by the rank-4 ladder. Consistent with the Sudoku P0 approach.
- §6 floor (dig-to-minimal + relax, seed-level) + no silent downgrade (throw) → Task 3.
- §9 bundle hardening → already generic from P4 (PER_DIFFICULTY=3, achieved-selection); Task 4 Step 3 confirms Tectonic entries are in-band.

**Placeholder scan:** No TBD/TODO; every code step has full code; every run step has an expected result and an escalation path (Task 3 Step 4, Task 4 Step 3) rather than weakening assertions.

**Type consistency:** `TectonicCtx`/`makeCtx`/`isSolved` defined in Task 1, consumed in Task 2 (`LADDER`, `solveWithTechniques`, `rate`). Technique signatures `(ctx: TectonicCtx) => boolean` match `Technique<TectonicCtx>.apply`. `solveWithTechniques` returns the shared `TechniqueTrace`. `generateForDifficulty(prng, target, width?, height?): GeneratedTectonic` keeps its exported signature (Task 3), still called by `index.ts`. `digToMinimal`/`relaxToTarget` are module-private. `MAX_ATTEMPTS` (index.ts) raised to 60. The shared `measureEffort`/`bandFromEffort` core modules are untouched (still used by kakuro/yakuso).

**Known risk (documented, not a gap):** Tectonic's technique vocabulary is thin (council noted the smallest ceiling gain); like Sudoku, the middle bands may be sparsely populated, making per-seed exact yield modest — the 60-attempt loop + in-band bundle absorb it, and band calibration is the cross-type follow-up.
