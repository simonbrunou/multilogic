# Technique-Based Difficulty — P3 (Kakuro): Combination-Aware Rater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rate Kakuro by the hardest human sum-combination technique it requires, so a `hard`/`expert` request reliably serves a genuinely-hard (combo-elimination) puzzle instead of a random one.

**Architecture:** Build a combination-aware candidate model + a sound 3-rank technique ladder (forced cell → forced digit → combo-elimination) on the shared `technique-rating` framework. Kakuro has **no givens** (the player fills every white cell), so the Sudoku/Tectonic dig-to-minimal/relax floor does **not** apply — difficulty is a property of the random topology. The module's existing **closest-fallback** retry loop (kept, not switched to throw-on-miss) targets difficulty by retrying topologies, because Kakuro's difficulty is **bimodal** and the middle bands are not reliably generatable.

**Tech Stack:** TypeScript (engine-pure), Vitest (`bun run test:unit`), Bun. Pre-commit fallow gate (no dead exports, no `fallow-ignore`, cognitive complexity ≤20).

**Empirical grounding (investigation, 2026-06-15):** Across hundreds of generated 6×6 puzzles, the "hardest technique required" distribution is **bimodal**: ~70 % forced-cell-only (easy), ~1 % forced-digit (medium), ~30 % combo-elimination (expert). Larger grids shift toward expert but generate poorly (1–3 %) and make combo-elimination expensive. **Decision (user-approved): ship pragmatic ~2-band Kakuro** — implement the sound ladder honestly; `medium`/`hard` requests serve the closest reachable band via the existing closest-fallback + achieved-difficulty bundle selection (already shipped in P4). Do NOT fake bands or switch Kakuro to throw-on-miss (its bands aren't all reachable, so a throw-on-miss + exact-pregen contract would fail the build). Soundness of all three techniques was verified in the investigation (one unsound "hidden single" variant was caught and corrected — see the forced-digit rule below).

---

## File Structure

- **Create** `src/engine/puzzles/kakuro/techniques.ts` — `KakuroCtx`, `makeCtx`, the combination engine (`runPossibleDigits`, `runForcedDigits`, `digitFitsRun`), `propagate`, `place`, and the three techniques (`forcedCell`, `forcedDigit`, `comboElimination`). The single home of Kakuro deduction.
- **Modify** `src/engine/puzzles/kakuro/rater.ts` — replace the effort-based `rate()` with the shared framework + the 3-rank ladder + `bandForRank`. Add `solveWithTechniques`.
- **Modify** `src/engine/puzzles/kakuro/index.ts` — raise `MAX_ATTEMPTS` (keep the closest-fallback loop; do NOT add throw-on-miss).
- **Tests:** `tests/engine/puzzles/kakuro/techniques.test.ts` (new), `tests/engine/puzzles/kakuro/rater.test.ts` (modify).

---

### Task 1: Combination-aware technique module

**Files:**
- Create: `src/engine/puzzles/kakuro/techniques.ts`
- Test: `tests/engine/puzzles/kakuro/techniques.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine/puzzles/kakuro/techniques.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeCtx, isSolved, forcedCell, forcedDigit, comboElimination, runPossibleDigits, runForcedDigits } from '../../../../src/engine/puzzles/kakuro/techniques';
import { solveComplete } from '../../../../src/engine/puzzles/kakuro/solver';
import { generateForDifficulty } from '../../../../src/engine/puzzles/kakuro/generator';
import { rate } from '../../../../src/engine/puzzles/kakuro/rater';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import type { KakuroInstance } from '../../../../src/engine/puzzles/kakuro/types';

// 3x2: row0 all black; row1 = [black, white(4), white(5)]. h-run [4,5] sum 3 ⇒ {1,2};
// v-run down=1 forces cell4=1, down=2 forces cell5=2. Solvable by forced cells ⇒ easy.
const forced: KakuroInstance = {
  width: 3, height: 2,
  black: [true, true, true, true, false, false],
  clues: [{}, { down: 1 }, { down: 2 }, { right: 3 }, null, null]
};

describe('kakuro combination engine', () => {
  it('runPossibleDigits: a 2-cell run summing to 3 allows only {1,2}', () => {
    const poss = runPossibleDigits({ cells: [4, 5], target: 3 }, [0, 0, 0, 0, 0, 0]);
    expect([...poss].sort()).toEqual([1, 2]);
  });

  it('runForcedDigits: a 2-cell run summing to 17 forces both {8,9}', () => {
    const f = runForcedDigits({ cells: [0, 1], target: 17 }, [0, 0]);
    expect([...f].sort()).toEqual([8, 9]);
  });

  it('runForcedDigits: a 2-cell run summing to 6 forces nothing (3+ combos: {1,5},{2,4})', () => {
    expect(runForcedDigits({ cells: [0, 1], target: 6 }, [0, 0]).size).toBe(0);
  });

  it('forcedCell solves the forced instance to completion', () => {
    const ctx = makeCtx(forced);
    let guard = 0;
    while (!isSolved(ctx) && forcedCell(ctx) && guard++ < 50) { /* drive forced cells */ }
    expect(isSolved(ctx)).toBe(true);
    expect(ctx.grid[4]).toBe(1);
    expect(ctx.grid[5]).toBe(2);
  });

  it('the technique ladder never contradicts the unique solution of generated puzzles', () => {
    for (let s = 0; s < 12; s++) {
      const g = generateForDifficulty(createPrng(deriveSeed('kakuro', 'easy', 'sound', s)), 'easy');
      const unique = solveComplete(g.instance, 2);
      expect(unique.count).toBe(1);
      // Run the full ladder; whatever it places must equal the unique solution.
      const ctx = makeCtx(g.instance);
      let guard = 0;
      const apply = () => forcedCell(ctx) || forcedDigit(ctx) || comboElimination(ctx);
      while (!isSolved(ctx) && apply() && guard++ < 500) { /* solve as far as possible */ }
      for (let i = 0; i < ctx.grid.length; i++) {
        if (!g.instance.black[i] && ctx.grid[i] !== 0) {
          expect(ctx.grid[i], `cell ${i} (seed ${s})`).toBe(unique.solution![i]);
        }
      }
    }
  });

  it('rate returns a valid band for the forced instance', () => {
    expect(['easy', 'medium', 'hard', 'expert']).toContain(rate(forced));
    expect(rate(forced)).toBe('easy');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/engine/puzzles/kakuro/techniques.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/engine/puzzles/kakuro/techniques.ts`:

```ts
import { horizontalRuns, verticalRuns } from './rules';
import type { KakuroInstance } from './types';

/** A run reduced to the data the combination engine needs. */
export interface RunInfo {
  cells: number[];
  target: number | null;
}

export interface KakuroCtx {
  inst: KakuroInstance;
  grid: number[];
  cand: Set<number>[];
  runs: RunInfo[];
  cellRuns: number[][];
}

/** Digits that can still appear in a run's EMPTY cells: union over all valid distinct-digit
 *  completions of the remaining sum (or, for an unclued run, any unused digit). */
export function runPossibleDigits(run: RunInfo, grid: number[]): Set<number> {
  const placed = run.cells.map((c) => grid[c]).filter((v) => v !== 0);
  const used = new Set<number>(placed);
  const avail: number[] = [];
  for (let d = 1; d <= 9; d++) if (!used.has(d)) avail.push(d);
  if (run.target === null) return new Set<number>(avail);
  const remTarget = run.target - placed.reduce((s, v) => s + v, 0);
  const emptyCount = run.cells.filter((c) => grid[c] === 0).length;
  const union = new Set<number>();
  const rec = (start: number, count: number, sum: number, chosen: number[]): void => {
    if (count === 0) {
      if (sum === remTarget) for (const d of chosen) union.add(d);
      return;
    }
    for (let i = start; i < avail.length; i++) {
      if (sum + avail[i] > remTarget) break; // avail ascending ⇒ prune
      chosen.push(avail[i]);
      rec(i + 1, count - 1, sum + avail[i], chosen);
      chosen.pop();
    }
  };
  rec(0, emptyCount, 0, []);
  return union;
}

/** Digits present in EVERY valid completion of a run (forced into the run). */
export function runForcedDigits(run: RunInfo, grid: number[]): Set<number> {
  if (run.target === null) return new Set<number>();
  const placed = run.cells.map((c) => grid[c]).filter((v) => v !== 0);
  const used = new Set<number>(placed);
  const avail: number[] = [];
  for (let d = 1; d <= 9; d++) if (!used.has(d)) avail.push(d);
  const remTarget = run.target - placed.reduce((s, v) => s + v, 0);
  const emptyCount = run.cells.filter((c) => grid[c] === 0).length;
  let inter: Set<number> | null = null;
  const rec = (start: number, count: number, sum: number, chosen: number[]): void => {
    if (count === 0) {
      if (sum !== remTarget) return;
      if (inter === null) inter = new Set<number>(chosen);
      else for (const d of [...inter]) if (!chosen.includes(d)) inter.delete(d);
      return;
    }
    for (let i = start; i < avail.length; i++) {
      if (sum + avail[i] > remTarget) break;
      chosen.push(avail[i]);
      rec(i + 1, count - 1, sum + avail[i], chosen);
      chosen.pop();
    }
  };
  rec(0, emptyCount, 0, []);
  return inter ?? new Set<number>();
}

/** Can digit `d` sit at empty cell `i` of `run` with the OTHER empty cells filled
 *  consistently (distinct, each in its candidate set, summing to the run target)? */
export function digitFitsRun(run: RunInfo, i: number, d: number, ctx: KakuroCtx): boolean {
  const { grid } = ctx;
  const placed = run.cells.map((c) => grid[c]).filter((v) => v !== 0);
  const used = new Set<number>(placed);
  if (used.has(d)) return false;
  if (run.target === null) return true; // distinctness already satisfied
  const others = run.cells.filter((c) => c !== i && grid[c] === 0);
  const target2 = run.target - placed.reduce((s, v) => s + v, 0) - d;
  const avail: number[] = [];
  for (let x = 1; x <= 9; x++) if (!used.has(x) && x !== d) avail.push(x);
  const assign = (k: number, sum: number, usedDigits: Set<number>): boolean => {
    if (k === others.length) return sum === target2;
    for (const x of avail) {
      if (usedDigits.has(x) || !ctx.cand[others[k]].has(x) || sum + x > target2) continue;
      usedDigits.add(x);
      if (assign(k + 1, sum + x, usedDigits)) return true;
      usedDigits.delete(x);
    }
    return false;
  };
  return assign(0, 0, new Set<number>([d]));
}

function buildRuns(inst: KakuroInstance): { runs: RunInfo[]; cellRuns: number[][] } {
  const runs: RunInfo[] = [];
  const cellRuns: number[][] = inst.black.map(() => []);
  const add = (cells: number[], sum: number | undefined) => {
    if (!cells.length) return;
    const idx = runs.length;
    runs.push({ cells, target: sum ?? null });
    for (const c of cells) cellRuns[c].push(idx);
  };
  for (const r of horizontalRuns(inst.width, inst.height, inst.black)) {
    add(r.cells, r.clueIndex >= 0 ? inst.clues[r.clueIndex]?.right : undefined);
  }
  for (const r of verticalRuns(inst.width, inst.height, inst.black)) {
    add(r.cells, r.clueIndex >= 0 ? inst.clues[r.clueIndex]?.down : undefined);
  }
  return { runs, cellRuns };
}

/** Intersect every empty cell's candidates with its runs' possible digits, to a fixpoint. */
function propagate(ctx: KakuroCtx): boolean {
  let changedAny = false;
  let changed = true;
  while (changed) {
    changed = false;
    for (const run of ctx.runs) {
      const poss = runPossibleDigits(run, ctx.grid);
      for (const c of run.cells) {
        if (ctx.grid[c] !== 0) continue;
        for (const dd of [...ctx.cand[c]]) {
          if (!poss.has(dd)) {
            ctx.cand[c].delete(dd);
            changed = true;
            changedAny = true;
          }
        }
      }
    }
  }
  return changedAny;
}

function place(ctx: KakuroCtx, i: number, d: number): void {
  ctx.grid[i] = d;
  ctx.cand[i] = new Set<number>([d]);
}

/** Build a context with combination-restricted candidates for all white cells. */
export function makeCtx(inst: KakuroInstance): KakuroCtx {
  const { runs, cellRuns } = buildRuns(inst);
  const grid = inst.black.map(() => 0);
  const cand = inst.black.map((b) => (b ? new Set<number>() : new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9])));
  const ctx: KakuroCtx = { inst, grid, cand, runs, cellRuns };
  propagate(ctx);
  return ctx;
}

export function isSolved(ctx: KakuroCtx): boolean {
  return ctx.inst.black.every((b, i) => b || ctx.grid[i] !== 0);
}

/** Rank 1: combination-propagate, then place any cell left with a single candidate. */
export function forcedCell(ctx: KakuroCtx): boolean {
  propagate(ctx);
  for (let i = 0; i < ctx.grid.length; i++) {
    if (!ctx.inst.black[i] && ctx.grid[i] === 0 && ctx.cand[i].size === 1) {
      place(ctx, i, [...ctx.cand[i]][0]);
      return true;
    }
  }
  return false;
}

/** Rank 2: a digit forced into every combo of a run, with exactly one empty cell able to hold it. */
export function forcedDigit(ctx: KakuroCtx): boolean {
  for (const run of ctx.runs) {
    for (const d of runForcedDigits(run, ctx.grid)) {
      const homes = run.cells.filter((c) => ctx.grid[c] === 0 && ctx.cand[c].has(d));
      if (homes.length === 1) {
        place(ctx, homes[0], d);
        return true;
      }
    }
  }
  return false;
}

/** Rank 3: eliminate a candidate digit that has no consistent completion in one of its runs. */
export function comboElimination(ctx: KakuroCtx): boolean {
  for (let i = 0; i < ctx.grid.length; i++) {
    if (ctx.inst.black[i] || ctx.grid[i] !== 0) continue;
    for (const d of [...ctx.cand[i]]) {
      for (const ri of ctx.cellRuns[i]) {
        if (!digitFitsRun(ctx.runs[ri], i, d, ctx)) {
          ctx.cand[i].delete(d);
          return true;
        }
      }
    }
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/engine/puzzles/kakuro/techniques.test.ts`
Expected: PASS. The soundness test (ladder never contradicts the unique solution across 12 generated puzzles) is the critical one — if it FAILS, STOP and report the failing cell/seed; a technique is unsound and must be fixed before proceeding (do not weaken the test).

- [ ] **Step 5: Purity + complexity checks**

Run: `bun run check:engine && bun run lint`
Expected: clean. The combination functions and techniques are each small and single-purpose. If the fallow gate flags any function's complexity, STOP and report the exact output (factor a helper; do not add a suppression).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/kakuro/techniques.ts tests/engine/puzzles/kakuro/techniques.test.ts
git commit -m "feat(kakuro): combination-aware technique ladder (forced cell, forced digit, combo elimination)"
```

---

### Task 2: Flip the Kakuro rater onto the shared framework

**Files:**
- Modify: `src/engine/puzzles/kakuro/rater.ts`
- Test: `tests/engine/puzzles/kakuro/rater.test.ts`

- [ ] **Step 1: Update the rater test**

Replace `tests/engine/puzzles/kakuro/rater.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { rate, solveWithTechniques } from '../../../../src/engine/puzzles/kakuro/rater';
import type { KakuroInstance } from '../../../../src/engine/puzzles/kakuro/types';

const forced: KakuroInstance = {
  width: 3, height: 2,
  black: [true, true, true, true, false, false],
  clues: [{}, { down: 1 }, { down: 2 }, { right: 3 }, null, null]
};

describe('kakuro rater', () => {
  it('rates a forced-cell-solvable instance as easy', () => {
    expect(rate(forced)).toBe('easy');
  });

  it('solveWithTechniques solves the forced instance', () => {
    expect(solveWithTechniques(forced).solved).toBe(true);
  });

  it('returns a valid difficulty band', () => {
    expect(['easy', 'medium', 'hard', 'expert']).toContain(rate(forced));
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `bun run test:unit tests/engine/puzzles/kakuro/rater.test.ts`
Expected: FAIL — `solveWithTechniques` not exported yet (the current rater has no such export).

- [ ] **Step 3: Rewrite the rater**

Replace the entire contents of `src/engine/puzzles/kakuro/rater.ts` with:

```ts
import { makeCtx, isSolved, forcedCell, forcedDigit, comboElimination, type KakuroCtx } from './techniques';
import type { KakuroInstance } from './types';
import type { Difficulty } from '../../core/types';
import {
  rateByTechniques,
  solveByTechniques,
  type Technique,
  type TechniqueRater,
  type TechniqueTrace
} from '../../core/technique-rating';

// Kakuro deduction is sum-combination reasoning. Ranks: forced cell 1, forced digit 2,
// combo-elimination 3. The difficulty distribution is bimodal (mostly easy or expert),
// so `medium` is rare and `hard` is served by the module's closest-fallback (see index.ts).
const LADDER: Technique<KakuroCtx>[] = [
  { name: 'forcedCell', rank: 1, apply: forcedCell },
  { name: 'forcedDigit', rank: 2, apply: forcedDigit },
  { name: 'comboElimination', rank: 3, apply: comboElimination }
];

function bandForRank(rank: number): Difficulty {
  if (rank <= 1) return 'easy';
  if (rank <= 2) return 'medium';
  return 'expert';
}

const kakuroRater: TechniqueRater<KakuroCtx> = {
  ladder: LADDER,
  isSolved,
  bandForRank,
  // Disable the step-count bump: Kakuro is honestly ~2-band; don't fabricate tiers from step counts.
  topRankStepThreshold: Number.MAX_SAFE_INTEGER
};

/** Solve as far as the technique ladder allows; report solved + hardest rank + steps at that rank. */
export function solveWithTechniques(inst: KakuroInstance): TechniqueTrace {
  return solveByTechniques(makeCtx(inst), LADDER, isSolved);
}

/** Rate a Kakuro by the hardest sum-combination technique it requires (unsolved by ladder ⇒ expert). */
export function rate(inst: KakuroInstance): Difficulty {
  return rateByTechniques(kakuroRater, () => makeCtx(inst));
}
```

- [ ] **Step 4: Run the rater test, expect pass**

Run: `bun run test:unit tests/engine/puzzles/kakuro/rater.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Whole suite + checks**

Run: `bun run test:unit && bun run check:engine && bun run lint`
Expected: green/clean. The old effort imports (`measureEffort`, `bandFromEffort`, `EffortModel`, the local `constraints`/`candidate`/`effortModel` helpers, `KAKURO_T1/T2`) are gone from the rater — confirm no unused-import/dead-code lint failures. `kakuro/hint.ts` and `solver.ts` do not import the rater, so they are unaffected. Update any other kakuro test that asserted the old effort bands to the technique bands (keep coverage). The shared `core/effort.ts`/`difficulty.ts` stay (yakuso still uses them).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/kakuro/rater.ts tests/engine/puzzles/kakuro/rater.test.ts
git commit -m "feat(kakuro): technique-based rate() on shared framework (closest-fallback for unreachable bands)"
```

---

### Task 3: Raise generation attempts (keep closest-fallback)

**Files:**
- Modify: `src/engine/puzzles/kakuro/index.ts`
- Test: `tests/engine/puzzles/kakuro/module.test.ts`

- [ ] **Step 1: Read the module + its test**

Run: `cat src/engine/puzzles/kakuro/index.ts tests/engine/puzzles/kakuro/module.test.ts`
Confirm `generate()` uses the closest-fallback loop (`MAX_ATTEMPTS = 12`, returns exact match if found else the closest `best`). **We KEEP this closest-fallback behavior** — do NOT convert Kakuro to throw-on-miss; its bands are not all reachable, and the in-band-or-bust contract would fail. We only raise the attempt budget so `expert` (~30 % per-attempt) is reliably hit.

- [ ] **Step 2: Write/extend the module test**

Add to `tests/engine/puzzles/kakuro/module.test.ts` (add imports `createPrng`, `deriveSeed` from `../../../../src/engine/core/prng` and `DIFFICULTIES` from `../../../../src/engine/core/types` if missing; use the module's import name `kakuro`):

```ts
  it('generate returns a valid puzzle with an honest achievedDifficulty for every request', async () => {
    for (const difficulty of DIFFICULTIES) {
      const prng = createPrng(deriveSeed('kakuro', difficulty, 'module-band', 0));
      const res = await kakuro.generate({ difficulty, prng, signal: new AbortController().signal });
      expect(['easy', 'medium', 'hard', 'expert']).toContain(res.achievedDifficulty);
      expect(res.source).toBe('live');
      // Closest-fallback contract: the returned puzzle is a real, uniquely-solvable Kakuro.
      expect(res.instance.black.length).toBe(res.solution.length);
    }
  });

  it('an expert request reliably yields a non-easy puzzle within the attempt budget', async () => {
    // Expert (~30% per attempt) should almost always be hit in 60 attempts.
    const prng = createPrng(deriveSeed('kakuro', 'expert', 'module-expert', 0));
    const res = await kakuro.generate({ difficulty: 'expert', prng, signal: new AbortController().signal });
    expect(['hard', 'expert']).toContain(res.achievedDifficulty);
  });
```

- [ ] **Step 3: Run, expect failure/flakiness**

Run: `bun run test:unit tests/engine/puzzles/kakuro/module.test.ts`
Expected: the "expert reliably non-easy" test may FAIL under `MAX_ATTEMPTS=12` (12 attempts at ~30 % can miss).

- [ ] **Step 4: Raise the attempt budget**

In `src/engine/puzzles/kakuro/index.ts`, change `const MAX_ATTEMPTS = 12;` to `const MAX_ATTEMPTS = 60;`. Make NO other change — the closest-fallback loop and `RANK` stay.

- [ ] **Step 5: Run, expect pass**

Run: `bun run test:unit tests/engine/puzzles/kakuro/module.test.ts`
Expected: PASS. If the expert test is still flaky, raise to 100 and re-run; if it cannot reach hard/expert at all, STOP and report (it would mean the rater never produces expert — a soundness/threshold problem to escalate).

- [ ] **Step 6: Full suite + checks**

Run: `bun run test:unit && bun run check:engine && bun run lint`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/engine/puzzles/kakuro/index.ts tests/engine/puzzles/kakuro/module.test.ts
git commit -m "feat(kakuro): raise generation attempts so expert is reliably reached (closest-fallback retained)"
```

---

### Task 4: End-to-end verification

**Files:** none (verification); optional spec note.

- [ ] **Step 1: Measure the Kakuro band distribution under the new rater**

Run (delete the file after):

```bash
cd /home/sbrn/Projects/multilogic
cat > ./_kdist.ts <<'EOF'
import { kakuro } from './src/engine/puzzles/kakuro';
import { generateForDifficulty } from './src/engine/puzzles/kakuro/generator';
import { rate } from './src/engine/puzzles/kakuro/rater';
import { createPrng, deriveSeed } from './src/engine/core/prng';
import { DIFFICULTIES } from './src/engine/core/types';
// Raw rate() distribution over random topologies:
const hist: Record<string, number> = { easy: 0, medium: 0, hard: 0, expert: 0 };
for (let s = 0; s < 120; s++) {
  try { const g = generateForDifficulty(createPrng(deriveSeed('kakuro', 'x', 'dist', s)), 'easy'); hist[g.difficulty]++; } catch { /* skip */ }
}
console.log('raw rate() distribution over 120 random topologies:', hist);
// Module end-to-end achieved-band per request:
for (const target of DIFFICULTIES) {
  const got: Record<string, number> = {};
  for (let i = 0; i < 10; i++) {
    const prng = createPrng(deriveSeed('kakuro', target, 'mod', i));
    const r = await kakuro.generate({ difficulty: target, prng, signal: new AbortController().signal });
    got[r.achievedDifficulty] = (got[r.achievedDifficulty] || 0) + 1;
  }
  console.log(`request ${target.padEnd(7)} → achieved`, got);
}
EOF
bun run ./_kdist.ts; rm -f ./_kdist.ts
```

Record the output. Confirm: `expert` requests reliably achieve `expert` (or `hard`); `easy` reliably `easy`; `medium`/`hard` requests serve the closest reachable band (this is the accepted 2-band behavior). If `expert` is never achieved, escalate.

- [ ] **Step 2: Record the result in the spec**

Edit `docs/superpowers/specs/2026-06-15-technique-based-difficulty-design.md` §5/§6: add a short `### P3 result — Kakuro (pragmatic 2-band)` note: the sound 3-rank combination ladder, the bimodal distribution, the decision to keep closest-fallback (not throw-on-miss), and the measured numbers.

- [ ] **Step 3: Confirm bundle still builds (closest-fallback, may be off-band for rare tiers)**

Run: `bun run pregen` then:
```bash
node -e "const b=require('./static/puzzles.bundle.json'); const k=b.puzzles.filter(p=>p.type==='kakuro'); console.log('kakuro entries:', k.map(p=>p.requested+'→'+p.achieved).join(', '))"
```
Expected: 12 kakuro entries; `easy→easy` and `expert→expert` present, `medium`/`hard` requests may show `→easy`/`→expert` (off-band is EXPECTED for Kakuro — closest-fallback, not a build failure). pregen must NOT throw (Kakuro never throws-on-miss). The bundle JSON is gitignored/built at deploy.

- [ ] **Step 4: Final full verification + commit the note**

Run: `bun run test:unit && bun run check:engine && bun run lint`
Expected: all green.

```bash
git add docs/superpowers/specs/2026-06-15-technique-based-difficulty-design.md
git commit -m "docs(difficulty): record P3 Kakuro result (pragmatic 2-band)"
```

---

## Self-Review

**Spec coverage (Kakuro rows of §5/§6/§9, as amended by the investigation):**
- §5 Kakuro ladder → Task 1 (3 sound techniques) + Task 2 (`bandForRank`). Corrected from the spec's 4-rank hypothesis to the empirically-grounded 3-rank ladder (forced cell / forced digit / combo-elimination); "combo restriction sweep" dropped (subsumed by rank-1 propagation).
- §6 generation → Task 3. Kakuro has no givens, so dig-to-minimal/relax does NOT apply (documented); difficulty is topology-driven and the closest-fallback retry loop targets it. **Deliberately NOT throw-on-miss** — bimodal bands aren't all reachable, so an in-band-or-bust contract would fail; closest-fallback + achieved-difficulty bundle selection (P4) serves the nearest reachable band.
- §9 bundle → already generic (P4). Task 4 Step 3 confirms Kakuro entries build (off-band entries for rare tiers are expected, not a failure).
- §10 soundness cross-check → Task 1 Step 4 (the ladder never contradicts the unique solution across generated puzzles) — the critical correctness gate, grounded in the investigation that caught and fixed an unsound forced-digit variant.

**Deviation from spec, documented:** the spec assumed 4 reachable Kakuro bands; the investigation proved the distribution is bimodal. User approved shipping pragmatic ~2-band Kakuro. `bandForRank` is honest (easy/medium/expert; no fabricated `hard`), the step-count bump is disabled (`topRankStepThreshold` = MAX), and unreachable requests degrade gracefully via closest-fallback. This is the right behavior for a type that genuinely lacks four tiers.

**Placeholder scan:** No TBD/TODO; full code in every code step; every run step has an expected result and an escalation path (Task 1 Step 4, Task 3 Step 5, Task 4 Step 1) rather than weakening assertions.

**Type consistency:** `KakuroCtx`/`RunInfo`/`makeCtx`/`isSolved` defined in Task 1, consumed in Task 2 (`LADDER`, `solveWithTechniques`, `rate`). Technique signatures `(ctx: KakuroCtx) => boolean` match `Technique<KakuroCtx>.apply`. `runPossibleDigits`/`runForcedDigits`/`digitFitsRun` exported for tests; `propagate`/`place`/`buildRuns` module-private. `solveWithTechniques` returns the shared `TechniqueTrace`. `MAX_ATTEMPTS` (index.ts) raised to 60; the closest-fallback loop + `RANK` unchanged. `generateForDifficulty` is untouched (still topology-based, keeps `void target`) and now reports the new rater's band automatically (it imports `rate`).
