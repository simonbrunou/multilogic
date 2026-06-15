# Technique-Based Difficulty — P4 (Sudoku): Generation Floor + Bundle Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sudoku generation reliably *produce* puzzles at the requested band (so the technique rater from P0 actually reaches players), with a hardened fallback bundle that never silently serves an under-difficulty puzzle.

**Architecture:** Replace Sudoku's "dig until ≤ target" generator with **dig-to-minimal then relax-to-target**: strip every uniqueness-preserving clue (hardest form), then add clues back until the band drops to the target — exploring the seed's whole difficulty range so the target band is hit with high yield. The module's generate loop accepts only an exact-band match and otherwise **throws** (no silent downgrade), so the worker falls back to the bundle. The bundle is regenerated with multiple puzzles per band and selected by *achieved* (not *requested*) difficulty.

**Tech Stack:** TypeScript (runtime-agnostic engine: no DOM/Worker/Math.random/crypto — enforced by `tsconfig.engine.json` + ESLint), Vitest (`bun run test:unit`), Bun (`bun run pregen`, `bun run scripts/bench-difficulty.ts`).

**Why this refines the spec:** Spec §6 sketched the floor as "dig to ceiling, then retry seeds." P0's benchmark (`scripts/bench-difficulty.ts`) measured per-band hit-rates of easy 100% / medium 5% / hard 15% / expert 35% under ceiling-only digging — proving pure seed-retry would be slow and flaky for the middle bands. Dig-to-minimal + relax-to-target raises per-seed yield dramatically because every seed is walked across its full difficulty range. Seed-retry + throw-on-miss remain as the backstop. This is an evidence-driven mechanism refinement, not a scope change: the design's invariants (seed-level not per-removal; no silent downgrade; trustworthy bundle) are all preserved.

**Scope:** Sudoku only (the one type on the technique rater after P0). Tectonic/Yakuso/Kakuro keep their effort-based generators until their own phases. The shared `generateWithFallback` is NOT changed (other types still rely on its closest-fallback behavior); the throw-on-miss logic lives in Sudoku's own module loop. `scripts/**` is exempt from the fallow health gate.

---

## File Structure

- **Modify** `src/engine/puzzles/sudoku/generator.ts` — replace `generateForDifficulty` with `digToMinimal` + `relaxToTarget` + a thin `generateForDifficulty` that composes them. Guarantees `rate(result) ≤ target`, aiming for `== target`.
- **Modify** `src/engine/puzzles/sudoku/index.ts` — `generate()` accepts only an exact-band match across raised attempts; throws otherwise (drop the closest-fallback `closerTo`/`RANK`).
- **Modify** `src/lib/puzzle-service.ts` — `pickFromBundle` selects by `achieved` difficulty, tie-broken by a seed hash for replay variety.
- **Modify** `scripts/pregen.ts` — `PER_DIFFICULTY = 3`; raise `MAX_SEED_ATTEMPTS`; assert each Sudoku bundle entry is exactly in-band.
- **Regenerate** `static/puzzles.bundle.json`.
- **Tests:** `tests/engine/puzzles/sudoku/generator.test.ts`, `tests/engine/puzzles/sudoku/module.test.ts`, `tests/lib/puzzle-service.test.ts` (create if absent).

---

### Task 1: Dig-to-minimal + relax-to-target generator

**Files:**
- Modify: `src/engine/puzzles/sudoku/generator.ts`
- Test: `tests/engine/puzzles/sudoku/generator.test.ts`

- [ ] **Step 1: Read the current generator and its test**

Run: `cat src/engine/puzzles/sudoku/generator.ts tests/engine/puzzles/sudoku/generator.test.ts`
Note the existing exports (`generateForDifficulty`, `GeneratedSudoku`) and any test that asserts the old "≤ target" behavior — those assertions get replaced in Step 5.

- [ ] **Step 2: Write the failing test**

Replace the contents of `tests/engine/puzzles/sudoku/generator.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { generateForDifficulty } from '../../../../src/engine/puzzles/sudoku/generator';
import { rate } from '../../../../src/engine/puzzles/sudoku/rater';
import { solveComplete } from '../../../../src/engine/puzzles/sudoku/solver';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import { DIFFICULTIES, type Difficulty } from '../../../../src/engine/core/types';

const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

describe('sudoku generateForDifficulty (dig-to-minimal + relax)', () => {
  it('never overshoots the target band and stays uniquely solvable', () => {
    for (const target of DIFFICULTIES) {
      for (let s = 0; s < 6; s++) {
        const g = generateForDifficulty(createPrng(deriveSeed('sudoku', target, 'overshoot', s)), target);
        expect(RANK[g.difficulty]).toBeLessThanOrEqual(RANK[target]);
        expect(g.difficulty).toBe(rate({ givens: g.givens })); // reported band matches the rater
        expect(solveComplete({ givens: g.givens }, 2).count).toBe(1); // unique
      }
    }
  });

  it('reaches every target band within a small seed batch', () => {
    for (const target of DIFFICULTIES) {
      let hit = false;
      for (let s = 0; s < 24 && !hit; s++) {
        if (generateForDifficulty(createPrng(deriveSeed('sudoku', target, 'reach', s)), target).difficulty === target) {
          hit = true;
        }
      }
      expect(hit, `target ${target} should be reachable within 24 seeds`).toBe(true);
    }
  });

  it('a generated solution is a complete valid grid', () => {
    const g = generateForDifficulty(createPrng(deriveSeed('sudoku', 'hard', 'sol', 0)), 'hard');
    expect(g.solution.every((v) => v >= 1 && v <= 9)).toBe(true);
    expect(g.solution.length).toBe(81);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test:unit tests/engine/puzzles/sudoku/generator.test.ts`
Expected: the "never overshoots" / "reaches every band" tests FAIL or are flaky under the OLD generator (it digs to ≤ target but rarely hits middle bands — `expert` reachability and exact-band behavior differ).

- [ ] **Step 4: Rewrite the generator**

Replace the entire contents of `src/engine/puzzles/sudoku/generator.ts` with:

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

/** Remove every clue whose removal preserves a unique solution → the hardest (minimal) form of this grid. */
function digToMinimal(prng: PRNG, solution: SudokuGrid): SudokuGrid {
  const givens = [...solution];
  for (const i of prng.shuffle([...Array(81)].map((_, k) => k))) {
    const saved = givens[i];
    givens[i] = 0;
    if (solveComplete({ givens }, 2).count !== 1) givens[i] = saved;
  }
  return givens;
}

/**
 * Add removed clues back (in PRNG order) until the band drops to `target` or below.
 * Adding a clue never raises difficulty, so this always terminates at ≤ target
 * (worst case the full solution, which rates `easy`). Stops at the first ≤-target band.
 */
function relaxToTarget(prng: PRNG, minimal: SudokuGrid, solution: SudokuGrid, target: Difficulty): SudokuGrid {
  const givens = [...minimal];
  if (RANK[rate({ givens })] <= RANK[target]) return givens;
  const removed = prng.shuffle([...Array(81)].map((_, k) => k).filter((k) => givens[k] === 0));
  for (const i of removed) {
    givens[i] = solution[i];
    if (RANK[rate({ givens })] <= RANK[target]) break;
  }
  return givens;
}

/**
 * Generate a unique Sudoku aimed at `target`. Digs to the minimal (hardest) form, then
 * relaxes down to the target band. Guarantees `rate(givens) <= target`; hits `== target`
 * with high yield. The module loop (index.ts) retries seeds for an exact-band match.
 */
export function generateForDifficulty(prng: PRNG, target: Difficulty): GeneratedSudoku {
  const solution = generateFullGrid(prng);
  const minimal = digToMinimal(prng, solution);
  const givens = relaxToTarget(prng, minimal, solution, target);
  return { givens, solution, difficulty: rate({ givens }) };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit tests/engine/puzzles/sudoku/generator.test.ts`
Expected: PASS. If "reaches every target band" fails for `expert` within 24 seeds, raise that loop bound to 40 and re-run; if it still fails, STOP and report — it means dig-to-minimal isn't producing expert often enough and the band cut points need revisiting (escalate, do not weaken the assertion).

- [ ] **Step 6: Confirm engine purity + no dead exports**

Run: `bun run check:engine && bun run lint`
Expected: clean. `digToMinimal`/`relaxToTarget` are module-private; `generateForDifficulty`/`GeneratedSudoku` remain exported and used by `index.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/engine/puzzles/sudoku/generator.ts tests/engine/puzzles/sudoku/generator.test.ts
git commit -m "feat(sudoku): dig-to-minimal + relax-to-target generation"
```

---

### Task 2: Exact-band module loop with throw-on-miss

**Files:**
- Modify: `src/engine/puzzles/sudoku/index.ts`
- Test: `tests/engine/puzzles/sudoku/module.test.ts`

- [ ] **Step 1: Read the current module + its test**

Run: `cat src/engine/puzzles/sudoku/index.ts tests/engine/puzzles/sudoku/module.test.ts`
Confirm `generate()` currently loops `MAX_ATTEMPTS = 8`, uses `closerTo`/`RANK` to return the closest band on a miss. Note which `module.test.ts` assertions depend on that closest-fallback.

- [ ] **Step 2: Write the failing test**

Add these tests to `tests/engine/puzzles/sudoku/module.test.ts` (keep existing imports; add any missing — `createPrng`, `deriveSeed` from `../../../../src/engine/core/prng`, `DIFFICULTIES` from `../../../../src/engine/core/types`):

```ts
  it('generate returns a puzzle whose achievedDifficulty exactly equals the request', async () => {
    for (const difficulty of DIFFICULTIES) {
      const prng = createPrng(deriveSeed('sudoku', difficulty, 'module-exact', 0));
      const signal = new AbortController().signal;
      const res = await sudoku.generate({ difficulty, prng, signal });
      expect(res.achievedDifficulty).toBe(difficulty);
      expect(res.source).toBe('live');
    }
  });
```

(If `sudoku` is imported under a different name in this file, use that name.)

- [ ] **Step 3: Run test to verify it fails or is flaky**

Run: `bun run test:unit tests/engine/puzzles/sudoku/module.test.ts`
Expected: under the OLD loop (8 attempts, closest-fallback) the exact-match assertion can FAIL for middle bands (it may return a close-but-wrong band).

- [ ] **Step 4: Rewrite the module generate loop**

In `src/engine/puzzles/sudoku/index.ts`:

(a) Delete the now-unused `RANK` constant and the `closerTo` helper function.
(b) Change `const MAX_ATTEMPTS = 8;` to `const MAX_ATTEMPTS = 40;`.
(c) Replace the `async generate(...)` method body with:

```ts
  async generate(args: GenArgs): Promise<GenResult<SudokuInstance, SudokuSolution>> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (args.signal.aborted) throw new Error('generation aborted');
      const g = generateForDifficulty(args.prng, args.difficulty);
      if (g.difficulty === args.difficulty) {
        return { instance: { givens: g.givens }, solution: g.solution, achievedDifficulty: g.difficulty, source: 'live' };
      }
    }
    throw new Error(`could not generate sudoku at ${args.difficulty} within ${MAX_ATTEMPTS} attempts`);
  },
```

(d) Remove the now-unused `GeneratedSudoku` import if it was only used by `closerTo` (keep it only if still referenced). Run `bun run lint` to catch leftover unused imports.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit tests/engine/puzzles/sudoku/module.test.ts`
Expected: PASS — every band returns an exact match. If any existing test asserted the old closest-fallback downgrade, update it to expect either an exact band or a thrown error (the new contract), keeping the assertion meaningful.

- [ ] **Step 6: Engine + lint clean**

Run: `bun run check:engine && bun run lint`
Expected: clean (no unused `RANK`/`closerTo`/imports — the fallow gate blocks dead code).

- [ ] **Step 7: Commit**

```bash
git add src/engine/puzzles/sudoku/index.ts tests/engine/puzzles/sudoku/module.test.ts
git commit -m "feat(sudoku): exact-band generate loop, throw on miss (no silent downgrade)"
```

---

### Task 3: Bundle selection by achieved difficulty + replay variety

**Files:**
- Modify: `src/lib/puzzle-service.ts`
- Test: `tests/lib/puzzle-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/puzzle-service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickFromBundle, type Bundle } from '../../src/lib/puzzle-service';

function entry(achieved: string, requested: string, tag: string) {
  return { type: 'sudoku', requested, achieved, instance: tag, solution: tag } as Bundle['puzzles'][number];
}

const bundle: Bundle = {
  engineVersion: 1,
  puzzles: [
    entry('easy', 'easy', 'E'),
    entry('medium', 'medium', 'M'),
    entry('hard', 'hard', 'H1'),
    entry('hard', 'hard', 'H2'),
    entry('hard', 'hard', 'H3')
  ]
};

describe('pickFromBundle', () => {
  it('selects by ACHIEVED difficulty', () => {
    expect(pickFromBundle(bundle, 'sudoku', 'medium', 'seed-a')?.achievedDifficulty).toBe('medium');
  });

  it('falls back to the closest ACHIEVED band when the exact one is absent', () => {
    // No expert entry → closest achieved is hard.
    expect(pickFromBundle(bundle, 'sudoku', 'expert', 'seed-a')?.achievedDifficulty).toBe('hard');
  });

  it('varies among equally-close matches by seed', () => {
    const tags = new Set<string>();
    for (const seed of ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']) {
      tags.add(pickFromBundle(bundle, 'sudoku', 'hard', seed)!.instance);
    }
    expect(tags.size).toBeGreaterThan(1); // not always the same hard puzzle
  });

  it('returns null when no puzzle of the type exists', () => {
    expect(pickFromBundle(bundle, 'kakuro', 'easy', 'seed-a')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/lib/puzzle-service.test.ts`
Expected: FAIL — `pickFromBundle` is not exported and the signature lacks `seed`.

- [ ] **Step 3: Update `pickFromBundle`**

In `src/lib/puzzle-service.ts`:

(a) Add a seed hash helper above `pickFromBundle`:

```ts
/** Tiny deterministic string hash (engine-free, no Math.random — keeps SSR/replay stable). */
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
```

(b) Replace the `pickFromBundle` function with (note: now `export`ed, takes `seed`, selects by `achieved`):

```ts
export function pickFromBundle(
  bundle: Bundle | null | undefined,
  puzzle: PuzzleType,
  difficulty: Difficulty,
  seed: string
): PuzzleResult | null {
  if (!bundle) return null;
  const candidates = bundle.puzzles.filter((p) => p.type === puzzle);
  if (candidates.length === 0) return null;
  const dist = (p: BakedPuzzle) => Math.abs(RANK[p.achieved] - RANK[difficulty]);
  const best = candidates.reduce((b, p) => (dist(p) < dist(b) ? p : b), candidates[0]);
  const close = candidates.filter((p) => dist(p) === dist(best));
  const pick = close[hashSeed(seed) % close.length];
  return { instance: pick.instance, solution: pick.solution, achievedDifficulty: pick.achieved, source: 'baked' };
}
```

(c) Update the one caller inside `request()` — the `fallbackOr` closure — to pass `seed`:

```ts
      const fallbackOr = (rej: () => void) => {
        const fb = pickFromBundle(opts.bundle, puzzle, difficulty, seed);
        if (fb) resolve(fb); else rej();
      };
```

(`seed` is the `request(puzzle, difficulty, seed)` parameter, in scope.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/lib/puzzle-service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Full check (this file is app code, type-checked by svelte-check)**

Run: `bun run test:unit && bun run lint`
Expected: clean; no other caller of `pickFromBundle` is broken (it had exactly one caller).

- [ ] **Step 6: Commit**

```bash
git add src/lib/puzzle-service.ts tests/lib/puzzle-service.test.ts
git commit -m "feat(puzzle-service): bundle selection by achieved difficulty with seed variety"
```

---

### Task 4: Pregen multiple puzzles per band + in-band guarantee

**Files:**
- Modify: `scripts/pregen.ts`
- Test: covered by running pregen + an assertion script (Step 3)

- [ ] **Step 1: Raise per-band count and seed attempts**

In `scripts/pregen.ts`:
(a) Change `const PER_DIFFICULTY = 1;` to `const PER_DIFFICULTY = 3;`.
(b) Change `const MAX_SEED_ATTEMPTS = 20;` to `const MAX_SEED_ATTEMPTS = 60;` (Sudoku's `generate()` now throws on miss, so pregen relies on seed-offset retries to find an in-band puzzle; the higher bound covers low-yield bands).

No other change — the existing loop already records `achieved: res.achievedDifficulty` and retries `seedOffset` on a thrown `generate()`.

- [ ] **Step 2: Regenerate the bundle**

Run: `bun run pregen`
Expected: `wrote 60 puzzles to static/puzzles.bundle.json` (5 types × 4 difficulties × 3). If pregen THROWS (`Failed to generate <type>/<difficulty> after 60 attempts`), that band is genuinely unreachable — STOP and report which type/band; for Sudoku that signals the band cut points need revisiting (do not silence it).

- [ ] **Step 3: Assert every Sudoku bundle entry is exactly in-band**

Run this one-liner:

```bash
node -e "const b=require('./static/puzzles.bundle.json'); const bad=b.puzzles.filter(p=>p.type==='sudoku'&&p.requested!==p.achieved); if(bad.length){console.error('OFF-BAND sudoku entries:',bad.map(p=>({req:p.requested,got:p.achieved})));process.exit(1)} console.log('all',b.puzzles.filter(p=>p.type==='sudoku').length,'sudoku entries in-band')"
```

Expected: `all 12 sudoku entries in-band` (3 per band × 4 bands). Because Sudoku's `generate()` now throws unless the band is exact, every Sudoku bundle entry must have `requested === achieved`. (Other types may still show `requested !== achieved` — that's expected; they're not on the new rater yet.)

- [ ] **Step 4: Commit**

```bash
git add scripts/pregen.ts static/puzzles.bundle.json
git commit -m "chore(pregen): 3 puzzles per band; Sudoku entries guaranteed in-band"
```

---

### Task 5: Measure yield/timing and verify the whole system

**Files:**
- Use: `scripts/bench-difficulty.ts` (from P0)

- [ ] **Step 1: Re-run the benchmark**

Run: `bun run scripts/bench-difficulty.ts`
Expected: every band's `hitRate` is now high (target: ≥ 80% for easy/medium/hard; expert may be lower but materially above its P0 35%). The `GATE` mean-time line should still PASS (dig-to-minimal does uniqueness checks but skips per-removal rating; relax adds bounded rate calls — keep an eye on the worst mean vs the 2000 ms budget).

- [ ] **Step 2: Record the result in the spec**

Edit `docs/superpowers/specs/2026-06-15-technique-based-difficulty-design.md`. Under the existing `### P0 benchmark result` subsection in §6, append a sibling line `### P4 result (post-floor)` quoting the new per-band hitRates and worst mean ms, and stating that Sudoku generation now lands in-band (the floor closed the P0 gap). Keep it factual and short.

- [ ] **Step 3: Full suite + checks**

Run: `bun run test:unit && bun run check:engine && bun run lint`
Expected: all green. If a pre-existing Sudoku test (generator/module/distribution) asserted the old closest-fallback behavior, update it to the new exact-or-throw contract — do not weaken coverage.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-15-technique-based-difficulty-design.md
git commit -m "docs(difficulty): record P4 post-floor generation yield"
```

---

## Self-Review

**Spec coverage (§6 floor, §9 bundle hardening — Sudoku scope):**
- §6 seed-level floor, never per-removal → Task 1 (dig-to-minimal + relax produce a per-seed in-band candidate) + Task 2 (exact-or-retry at the seed/loop level, never mid-dig).
- §6 no silent downgrade / throw → bundle fallback → Task 2 (throw on miss) + Task 3 (bundle serves the in-band puzzle). Worker→`puzzle-service` fallback path already exists (`fallbackOr` in `request()`); Task 3 feeds it `seed`.
- §6 "maxAttempts raised as measurement dictates" → Task 2 (`MAX_ATTEMPTS = 40`) + Task 4 (`MAX_SEED_ATTEMPTS = 60`), validated by Task 5's hitRate.
- §9 `PER_DIFFICULTY ≥ 3` → Task 4. Fallback selects by `achieved` → Task 3. Build-time in-band guarantee → Task 4 Step 3 (Sudoku entries `requested === achieved` by construction, asserted) + pregen throws if a band is unreachable.
- §9 regenerate `static/puzzles.bundle.json` → Task 4 Step 2.

**Deferred (not P4-Sudoku gaps):** Kakuro generator rewrite, Tectonic/Yakuso/Kakuro technique raters and their floors (their own phases); daily-route difficulty quick-win (spec §8, independent change); a generic build-time assertion for the other types' bundle entries (they remain closest-fallback until on the new rater).

**Placeholder scan:** No TBD/TODO; every code step shows full code; every run step states an expected result and an explicit escalation path if a band proves unreachable (Task 1 Step 5, Task 4 Step 2) rather than silently weakening assertions.

**Type consistency:** `generateForDifficulty(prng, target): GeneratedSudoku` keeps its exported signature (Task 1), still called by `index.ts` (Task 2). `digToMinimal`/`relaxToTarget` are module-private. `pickFromBundle` gains a 4th `seed: string` param and `export`; its sole caller (`request`’s `fallbackOr`) is updated in the same task (Task 3). `BakedPuzzle`/`Bundle`/`PuzzleResult`/`RANK` already exist in `puzzle-service.ts` and are reused. `MAX_ATTEMPTS` (index.ts) and `MAX_SEED_ATTEMPTS`/`PER_DIFFICULTY` (pregen.ts) are distinct constants in distinct files.
