# Technique-Based Difficulty — Greco-Latin: Honest Construction Rating + Floor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Greco-Latin's echoed-parameter difficulty with an honest construction-difficulty rating, and floor generation so a `hard`/`expert` puzzle is verified to actually require guessing (not just be sparsely revealed).

**Architecture:** Greco-Latin is a CONSTRUCTION puzzle (no unique solution, no deduction techniques), so it does not use the technique-rating framework. Instead, rate by the **residual free-choice ratio**: after propagating forced singles (cells with exactly one consistent (a,b) pair), what fraction of the originally-empty cells still need a free guess. Cheap (<1ms), and the empirically-validated proxy for human construction effort (forced-only puzzles are trivial; mostly-free puzzles need real search). Generation re-rolls the revealed cells until the rated band matches the request (a seed-level floor), and reports the real rating as `achievedDifficulty`.

**Tech Stack:** TypeScript (engine-pure), Vitest, Bun. Pre-commit fallow gate (no dead exports, no `fallow-ignore`, cognitive complexity ≤20).

**Empirical grounding (investigation, 2026-06-15):** At the current fixed order n=5, the reveal mapping DOES produce a real gradient (easy ~10 backtracks → expert ~460) and the direction (more givens = easier) is correct in the used range. The gap: difficulty is purely parameter-based and `achievedDifficulty` is echoed, so a lucky sparsely-revealed puzzle that propagation fully forces is served as `expert` but plays `easy`. The clean human-difficulty metric is the residual-free-choice ratio after forced-single propagation. **Decision: stay at order n=5** — raising the order genuinely increases difficulty but the `hint.ts` backtracker can freeze the UI at n≥7 (a separate hardening task), so order changes are out of scope here.

---

## File Structure

- **Create** `src/engine/puzzles/grecolatin/candidates.ts` — `Analysis`, `analyze`, `candidatesAt` (moved verbatim from `hint.ts`; shared by hint + rater).
- **Modify** `src/engine/puzzles/grecolatin/hint.ts` — import `analyze`/`candidatesAt` from `./candidates` instead of defining them.
- **Create** `src/engine/puzzles/grecolatin/rater.ts` — `residualFreeRatio(inst)`, `rate(inst)` (residual-ratio → band).
- **Modify** `src/engine/puzzles/grecolatin/generator.ts` — `generateForDifficulty` re-rolls reveals until the rated band == target (floor), returns the real rating; reveal ratios retained/retuned per calibration.
- **Modify** `src/engine/puzzles/grecolatin/index.ts` — report the real `achievedDifficulty` from the generator (it already passes `g.difficulty` through; the generator now sets it from `rate`).
- **Tests:** `tests/engine/puzzles/grecolatin/rater.test.ts` (new), `tests/engine/puzzles/grecolatin/generator.test.ts` (modify).

---

### Task 1: Extract the shared candidate model

**Files:**
- Create: `src/engine/puzzles/grecolatin/candidates.ts`
- Modify: `src/engine/puzzles/grecolatin/hint.ts`

- [ ] **Step 1: Read the current hint module**

Run: `cat src/engine/puzzles/grecolatin/hint.ts`
Confirm the exact bodies of `analyze(n, grid)` and `candidatesAt(n, an, i)` and the `Analysis` interface (you will move them verbatim).

- [ ] **Step 2: Create the shared module**

Create `src/engine/puzzles/grecolatin/candidates.ts` with the `Analysis` interface, `analyze`, and `candidatesAt` moved VERBATIM from `hint.ts` (add `export` to all three):

```ts
import { decodePair } from './rules';

export interface Analysis {
  aRow: Set<number>[]; aCol: Set<number>[];
  bRow: Set<number>[]; bCol: Set<number>[];
  pairs: Set<number>;
}

/** Per-row/col used symbols (both projections) + globally-used pairs for a (partial) grid. */
export function analyze(n: number, grid: number[]): Analysis {
  const mk = () => Array.from({ length: n }, () => new Set<number>());
  const a: Analysis = { aRow: mk(), aCol: mk(), bRow: mk(), bCol: mk(), pairs: new Set<number>() };
  for (let i = 0; i < n * n; i++) {
    if (grid[i] === 0) continue;
    const p = decodePair(grid[i], n)!;
    const r = Math.floor(i / n), c = i % n;
    a.aRow[r].add(p.a); a.aCol[c].add(p.a); a.bRow[r].add(p.b); a.bCol[c].add(p.b);
    a.pairs.add(p.a * n + p.b);
  }
  return a;
}

/** All (a,b) pairs consistent with row/col Latin constraints + global pair-distinctness at cell `i`. */
export function candidatesAt(n: number, an: Analysis, i: number): { a: number; b: number }[] {
  const r = Math.floor(i / n), c = i % n;
  const out: { a: number; b: number }[] = [];
  for (let a = 0; a < n; a++) {
    if (an.aRow[r].has(a) || an.aCol[c].has(a)) continue;
    for (let b = 0; b < n; b++) {
      if (an.bRow[r].has(b) || an.bCol[c].has(b)) continue;
      if (an.pairs.has(a * n + b)) continue;
      out.push({ a, b });
    }
  }
  return out;
}
```

- [ ] **Step 3: Refactor `hint.ts` to use the shared module**

In `src/engine/puzzles/grecolatin/hint.ts`: delete the local `Analysis` interface, `analyze`, and `candidatesAt`; add `import { analyze, candidatesAt, type Analysis } from './candidates';` (keep `Analysis` import only if `hint.ts` references the type elsewhere — if not, import just the two functions). Leave the rest of `hint.ts` (`complete`, `hintCell`, `getHint`) unchanged.

- [ ] **Step 4: Verify hint behavior unchanged**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/hint.test.ts && bun run check:engine && bun run lint`
Expected: hint tests still pass; clean. `analyze`/`candidatesAt` are now used by hint (and will be used by the rater in Task 2), so no dead-export flag.

- [ ] **Step 5: Commit**

```bash
git add src/engine/puzzles/grecolatin/candidates.ts src/engine/puzzles/grecolatin/hint.ts
git commit -m "refactor(grecolatin): extract shared analyze/candidatesAt into candidates.ts"
```

---

### Task 2: Construction-difficulty rater + calibrate cuts

**Files:**
- Create: `src/engine/puzzles/grecolatin/rater.ts`
- Test: `tests/engine/puzzles/grecolatin/rater.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine/puzzles/grecolatin/rater.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rate, residualFreeRatio } from '../../../../src/engine/puzzles/grecolatin/rater';
import { buildSquare } from '../../../../src/engine/puzzles/grecolatin/generator';
import { createPrng } from '../../../../src/engine/core/prng';
import type { GrecoLatinInstance } from '../../../../src/engine/puzzles/grecolatin/types';

describe('grecolatin rater', () => {
  it('a fully-given square has residual ratio 0 and rates easy', () => {
    const sol = buildSquare(5, createPrng(1))!;
    const inst: GrecoLatinInstance = { n: 5, givens: sol };
    expect(residualFreeRatio(inst)).toBe(0);
    expect(rate(inst)).toBe('easy');
  });

  it('an all-empty square has residual ratio 1 and rates expert', () => {
    const inst: GrecoLatinInstance = { n: 5, givens: new Array(25).fill(0) };
    expect(residualFreeRatio(inst)).toBe(1);
    expect(rate(inst)).toBe('expert');
  });

  it('residualFreeRatio is in [0,1] and deterministic', () => {
    const sol = buildSquare(5, createPrng(7))!;
    const givens = sol.map((v, i) => (i % 2 === 0 ? v : 0)); // half-revealed
    const inst: GrecoLatinInstance = { n: 5, givens };
    const r1 = residualFreeRatio(inst);
    expect(r1).toBeGreaterThanOrEqual(0);
    expect(r1).toBeLessThanOrEqual(1);
    expect(residualFreeRatio(inst)).toBe(r1);
  });

  it('rate returns a valid band', () => {
    const sol = buildSquare(5, createPrng(3))!;
    const givens = sol.map((v, i) => (i < 8 ? v : 0));
    expect(['easy', 'medium', 'hard', 'expert']).toContain(rate({ n: 5, givens }));
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/rater.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the rater**

Create `src/engine/puzzles/grecolatin/rater.ts`:

```ts
import { analyze, candidatesAt } from './candidates';
import { encodePair } from './rules';
import type { GrecoLatinInstance } from './types';
import type { Difficulty } from '../../core/types';

/**
 * Fraction of originally-empty cells that remain UNFORCED after propagating forced
 * singles (cells with exactly one consistent pair). 0 = fully deducible (trivial);
 * 1 = nothing forced, every empty cell needs a free choice (hard). A forced single is
 * the only legal pair for that cell, so placing it is sound for any valid completion.
 */
export function residualFreeRatio(inst: GrecoLatinInstance): number {
  const n = inst.n;
  const grid = [...inst.givens];
  const totalEmpty = grid.filter((v) => v === 0).length;
  if (totalEmpty === 0) return 0;
  let changed = true;
  while (changed) {
    changed = false;
    const an = analyze(n, grid);
    for (let i = 0; i < n * n; i++) {
      if (grid[i] !== 0) continue;
      const cands = candidatesAt(n, an, i);
      if (cands.length === 1) {
        grid[i] = encodePair(cands[0].a, cands[0].b, n);
        changed = true;
      }
    }
  }
  return grid.filter((v) => v === 0).length / totalEmpty;
}

// Cut points calibrated in Step 5 against the residual-ratio distribution at the
// generator's reveal fractions (easy 0.6 … expert 0.2). Starting hypothesis:
function bandForRatio(r: number): Difficulty {
  if (r <= 0.34) return 'easy';
  if (r <= 0.67) return 'medium';
  if (r <= 0.9) return 'hard';
  return 'expert';
}

/** Rate a Greco-Latin instance by how much free-choice search its construction needs. */
export function rate(inst: GrecoLatinInstance): Difficulty {
  return bandForRatio(residualFreeRatio(inst));
}
```

- [ ] **Step 4: Run, expect pass**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/rater.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Calibrate `bandForRatio` cuts against the real distribution**

Run this measurement (delete after):

```bash
cd /home/sbrn/Projects/multilogic
cat > ./_gcal.ts <<'EOF'
import { buildSquare } from './src/engine/puzzles/grecolatin/generator';
import { residualFreeRatio } from './src/engine/puzzles/grecolatin/rater';
import { createPrng } from './src/engine/core/prng';
const REVEAL: Record<string, number> = { easy: 0.6, medium: 0.45, hard: 0.3, expert: 0.2 };
for (const [band, rev] of Object.entries(REVEAL)) {
  const ratios: number[] = [];
  for (let s = 0; s < 80; s++) {
    const prng = createPrng(s + 1);
    const sol = buildSquare(5, prng)!;
    const givens = new Array(25).fill(0);
    const order = prng.shuffle(sol.map((_, i) => i));
    const count = Math.max(1, Math.round(25 * rev));
    for (let k = 0; k < count; k++) givens[order[k]] = sol[order[k]];
    ratios.push(residualFreeRatio({ n: 5, givens }));
  }
  ratios.sort((a, b) => a - b);
  const med = ratios[40], p10 = ratios[8], p90 = ratios[72];
  console.log(`${band.padEnd(7)} rev=${rev} ratio p10=${p10.toFixed(2)} med=${med.toFixed(2)} p90=${p90.toFixed(2)}`);
}
EOF
bun run ./_gcal.ts; rm -f ./_gcal.ts
```

Read the output. Set `bandForRatio`'s cut points so that each reveal fraction's median ratio falls in its intended band AND the bands are ordered (easy ratio < medium < hard < expert). If the medians don't separate into four bands (e.g. medium and hard overlap), pick cuts that best separate them and note in a code comment which bands are squeezed; if two reveal fractions produce nearly identical ratio distributions, record that as a "bands not cleanly separable at n=5" finding for the Task 4 spec note (do NOT invent separation that isn't there). Update the three thresholds in `bandForRatio` to the calibrated values, then re-run `bun run test:unit tests/engine/puzzles/grecolatin/rater.test.ts` (the all-given⇒easy and all-empty⇒expert anchors must still hold).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/grecolatin/rater.ts tests/engine/puzzles/grecolatin/rater.test.ts
git commit -m "feat(grecolatin): residual-free-ratio construction rater (calibrated cuts)"
```

---

### Task 3: Floor generation + honest achievedDifficulty

**Files:**
- Modify: `src/engine/puzzles/grecolatin/generator.ts`
- Test: `tests/engine/puzzles/grecolatin/generator.test.ts`

- [ ] **Step 1: Write/extend the generator test**

Replace `tests/engine/puzzles/grecolatin/generator.test.ts` with (keep any existing valid-square assertions you find when reading it; this set covers the floor + honesty):

```ts
import { describe, it, expect } from 'vitest';
import { generateForDifficulty, buildSquare } from '../../../../src/engine/puzzles/grecolatin/generator';
import { rate } from '../../../../src/engine/puzzles/grecolatin/rater';
import { validateGrid } from '../../../../src/engine/puzzles/grecolatin/rules';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import { DIFFICULTIES } from '../../../../src/engine/core/types';

describe('grecolatin generateForDifficulty (floored, honest rating)', () => {
  it('reported difficulty equals the rater on the produced instance', () => {
    for (const target of DIFFICULTIES) {
      const g = generateForDifficulty(createPrng(deriveSeed('grecolatin', target, 'honest', 0)), target);
      expect(g.difficulty).toBe(rate(g.instance));
    }
  });

  it('the givens are a conflict-free partial Greco-Latin square', () => {
    const g = generateForDifficulty(createPrng(deriveSeed('grecolatin', 'hard', 'valid', 0)), 'hard');
    expect(validateGrid(g.instance.n, g.instance.givens).valid).toBe(true);
  });

  it('reaches each target band within the attempt budget', () => {
    for (const target of DIFFICULTIES) {
      let hit = false;
      for (let s = 0; s < 8 && !hit; s++) {
        if (generateForDifficulty(createPrng(deriveSeed('grecolatin', target, 'reach', s)), target).difficulty === target) hit = true;
      }
      expect(hit, `target ${target} reachable`).toBe(true);
    }
  });

  it('a buildSquare result is a complete valid Greco-Latin square', () => {
    const sol = buildSquare(5, createPrng(42))!;
    expect(validateGrid(5, sol).complete).toBe(true);
    expect(validateGrid(5, sol).valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/generator.test.ts`
Expected: FAIL — `g.difficulty` currently echoes `target` rather than the real `rate(g.instance)`, so the "reported equals rater" test fails for any puzzle whose real rating differs from the requested band.

- [ ] **Step 3: Rewrite `generateForDifficulty` to floor on the real rating**

In `src/engine/puzzles/grecolatin/generator.ts`, add an import `import { rate } from './rater';` and a `RANK` map, then replace the existing `generateForDifficulty` with a floored version that re-rolls the square + revealed cells until the rated band matches the target (else returns the closest). Keep `REVEAL`, `buildSquare`, `permute`, etc. unchanged:

```ts
const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };
const GEN_ATTEMPTS = 60;

/** Reveal `round(n*n*reveal)` random cells of `sol` (always at least 1). */
function revealGivens(sol: number[], n: number, reveal: number, prng: PRNG): number[] {
  const givens = new Array<number>(n * n).fill(0);
  const order = prng.shuffle(sol.map((_, i) => i));
  const count = Math.max(1, Math.round(n * n * reveal));
  for (let k = 0; k < count; k++) givens[order[k]] = sol[order[k]];
  return givens;
}

export function generateForDifficulty(prng: PRNG, target: Difficulty, n = 5): GeneratedGreco {
  let best: GeneratedGreco | null = null;
  for (let attempt = 0; attempt < GEN_ATTEMPTS; attempt++) {
    const sol = buildSquare(n, prng);
    if (!sol) throw new Error(`grecolatin: failed to build a square of order ${n}`);
    const givens = revealGivens(sol, n, REVEAL[target], prng);
    const instance: GrecoLatinInstance = { n, givens };
    const difficulty = rate(instance);
    if (difficulty === target) return { instance, difficulty };
    if (best === null || Math.abs(RANK[difficulty] - RANK[target]) < Math.abs(RANK[best.difficulty] - RANK[target])) {
      best = { instance, difficulty };
    }
  }
  return best!;
}
```

(Confirm `PRNG`, `Difficulty`, `GrecoLatinInstance`, `GeneratedGreco`, `REVEAL`, `buildSquare` are already imported/defined in the file — they are. The old single-shot reveal block is removed.)

- [ ] **Step 4: Run, expect pass**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/generator.test.ts`
Expected: PASS. The "reported equals rater" test now holds because `difficulty` IS `rate(instance)`. If "reaches each target band" fails for a band, that band's reveal fraction doesn't land there under the calibrated cuts — return to Task 2 Step 5 and adjust the cut for that band (or the reveal fraction in `REVEAL`), then re-run. Do not weaken the assertion.

- [ ] **Step 5: Confirm the module passes the honest rating through**

Run: `cat src/engine/puzzles/grecolatin/index.ts` — confirm `generate()` returns `achievedDifficulty: g.difficulty`. Since `g.difficulty` is now the real rating, no change is needed. If the module hard-codes `achievedDifficulty: args.difficulty` anywhere, change it to `g.difficulty`.

- [ ] **Step 6: Full suite + checks**

Run: `bun run test:unit && bun run check:engine && bun run lint`
Expected: all green. Update any greco module test that assumed `achievedDifficulty === requested` to allow the honest closest-band behavior (the module may now report a near band when the exact one isn't hit within budget — keep the assertion meaningful: a valid band + a valid partial square).

- [ ] **Step 7: Commit**

```bash
git add src/engine/puzzles/grecolatin/generator.ts tests/engine/puzzles/grecolatin/generator.test.ts
git commit -m "feat(grecolatin): floor generation on real rating; honest achievedDifficulty"
```

---

### Task 4: End-to-end verification

**Files:** none (verification); spec note.

- [ ] **Step 1: Measure the end-to-end behavior**

Run (delete after):

```bash
cd /home/sbrn/Projects/multilogic
cat > ./_gend.ts <<'EOF'
import { grecolatin } from './src/engine/puzzles/grecolatin';
import { rate } from './src/engine/puzzles/grecolatin/rater';
import { createPrng, deriveSeed } from './src/engine/core/prng';
import { DIFFICULTIES } from './src/engine/core/types';
for (const target of DIFFICULTIES) {
  const got: Record<string, number> = {};
  for (let i = 0; i < 15; i++) {
    const prng = createPrng(deriveSeed('grecolatin', target, 'verify', i));
    const r = await grecolatin.generate({ difficulty: target, prng, signal: new AbortController().signal });
    got[r.achievedDifficulty] = (got[r.achievedDifficulty] || 0) + 1;
  }
  console.log(`request ${target.padEnd(7)} → achieved`, got);
}
EOF
bun run ./_gend.ts; rm -f ./_gend.ts
```

Record the output. Confirm each request mostly achieves its target band (or the nearest), and that the achieved band is the REAL rating (honest). If a band is rarely hit, note it.

- [ ] **Step 2: Record in the spec**

Edit `docs/superpowers/specs/2026-06-15-technique-based-difficulty-design.md`: add a `### Greco-Latin result — honest construction rating` note (Greco is a construction puzzle, so it rates by residual-free-choice ratio, not techniques; stay at n=5; floor generation; report the real rating). Quote the calibrated cuts and the measured per-request distribution. Note any band-separation limit found in calibration.

- [ ] **Step 3: Final full verification + commit**

Run: `bun run test:unit && bun run check:engine && bun run lint` — all green.

```bash
git add docs/superpowers/specs/2026-06-15-technique-based-difficulty-design.md
git commit -m "docs(difficulty): record Greco-Latin honest construction rating"
```

---

## Self-Review

**Goal coverage:**
- Honest rating (not echoed param) → Task 2 (`rate` = residual-free-ratio) + Task 3 (generator reports `rate(instance)` as `difficulty`; module passes it through as `achievedDifficulty`).
- Floor (verify hard/expert actually require guessing) → Task 3 (re-roll until rated band == target, else closest).
- Calibration grounded in data, not guessed → Task 2 Step 5 (measure residual distribution at each reveal, set cuts; escalate if bands don't separate rather than fabricate).
- Stay at n=5 / avoid the hint-perf landmine → documented; order changes explicitly out of scope.

**Placeholder scan:** No TBD/TODO; full code in every code step; calibration Step 5 gives starting cuts + a concrete measurement + an explicit "don't invent separation" escalation. Every run step has an expected result.

**Type consistency:** `Analysis`/`analyze`/`candidatesAt` defined in Task 1 (`candidates.ts`), consumed by `hint.ts` (Task 1) and `rater.ts` (Task 2). `residualFreeRatio`/`rate` defined in Task 2, used by `generator.ts` (Task 3). `GeneratedGreco`/`GrecoLatinInstance`/`REVEAL`/`buildSquare`/`PRNG`/`Difficulty` are pre-existing in `generator.ts` and reused; `revealGivens` is the new module-private helper replacing the old inline reveal block; `RANK`/`GEN_ATTEMPTS` are new module constants. `grecolatin` stays a `ConstructionPuzzle` (no `rate` on its interface — `rate` is generator/rater-internal and surfaced only via `achievedDifficulty`).

**Risk noted (not a gap):** at fixed n=5 the four bands may not cleanly separate by residual ratio (the investigation showed some non-monotonicity at extreme reveals); calibration (Task 2 Step 5) sets the best cuts available and the floor's closest-fallback keeps every request serving a valid puzzle. Raising the order would widen the range but needs the `hint.ts` backtracker hardened first (MRV/timeout) — a separate follow-up.
