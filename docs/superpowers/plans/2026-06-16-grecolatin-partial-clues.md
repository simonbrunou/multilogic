# Greco-Latin Partial Clues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Greco-Latin clue reveal only the digit, only the letter, or both, rated honestly by an extended residual-free-ratio so a `hard` puzzle requires real cross-projection deduction.

**Architecture:** Replace the full-pair `givens` array with per-dimension `digitClues`/`letterClues`. Generalize the candidate model (`analyze`/`candidatesAt`) to per-dimension known state; generalize the rater to propagate per-dimension forced singles (re-analyzing after each placement for soundness); generation reveals a full/partial mix floored to the rated band; the play UI locks clued dimensions per-cell-dimension. Order stays n=5.

**Tech Stack:** TypeScript (engine-pure core), Svelte 5 runes (play UI), Vitest, Bun. Pre-commit fallow gate (no dead exports, no `fallow-ignore`, cognitive complexity ≤20). **Spec:** `docs/superpowers/specs/2026-06-16-grecolatin-partial-clues-design.md` (council-ratified v2). **Phase-0 measurement (passed):** soundness clean; partial clues populate residual 0.5–0.97; recalibration splits that into medium/hard.

**Green-gate strategy:** the instance-type change ripples to engine + UI. Engine tasks (1–6) keep `bun run check:engine` + `bun run test:unit` green (the engine never imports `.svelte`). UI tasks (7–9) update the store/board/routes; the full `bun run check` (svelte-check) is green only at the end of Task 9. Each task still commits.

---

## File Structure

- `src/engine/puzzles/grecolatin/types.ts` — `GrecoLatinInstance` shape change.
- `src/engine/puzzles/grecolatin/candidates.ts` — `analyze`/`candidatesAt` generalized to `(knownA, knownB)`.
- `src/engine/puzzles/grecolatin/rater.ts` — per-dimension propagation + recalibrated cuts.
- `src/engine/puzzles/grecolatin/generator.ts` — `revealPartial` + per-band schedule + floor.
- `src/engine/puzzles/grecolatin/index.ts` — `validate`/`validateMove`/`render` on the new model.
- `src/engine/puzzles/grecolatin/hint.ts` — consume `(knownA, knownB)`; single-dimension hints.
- `src/lib/play/greco.svelte.ts` — per-dimension locking.
- `src/lib/components/GrecoBoard.svelte` — per-token rendering; focusable predicate.
- `src/routes/{daily,play}/grecolatin/+page.svelte` — `store.load(...)` call.
- Tests across `tests/engine/puzzles/grecolatin/` + a component test.

---

### Task 1: Instance data model

**Files:** Modify `src/engine/puzzles/grecolatin/types.ts`; Test: none (type only).

- [ ] **Step 1: Change the interface**

Replace the `GrecoLatinInstance` interface body in `src/engine/puzzles/grecolatin/types.ts` with:

```ts
export interface GrecoLatinInstance {
  n: number;
  /** length n*n; given digit a ∈ 0..n-1, or null (open). */
  digitClues: (number | null)[];
  /** length n*n; given letter b ∈ 0..n-1, or null (open). */
  letterClues: (number | null)[];
}
```

Leave `GrecoLatinSolution`, `GrecoLatinState`, `GrecoLatinMove` unchanged.

- [ ] **Step 2: Confirm it compiles the type (consumers break — expected)**

Run: `bun run check:engine`
Expected: FAILS — `candidates.ts`/`rater.ts`/`generator.ts`/`hint.ts`/`index.ts` still reference `inst.givens`. This is expected; Tasks 2–6 fix the engine. Do NOT commit yet — commit at the end of Task 6 when the engine cluster is green (the type + all engine consumers change together).

(No commit this task; it's the first step of the engine cluster.)

---

### Task 2: Generalize the candidate model

**Files:** Modify `src/engine/puzzles/grecolatin/candidates.ts`; Test: `tests/engine/puzzles/grecolatin/candidates.test.ts` (create).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/puzzles/grecolatin/candidates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analyze, candidatesAt } from '../../../../src/engine/puzzles/grecolatin/candidates';

// Helpers: build knownA/knownB arrays for n=3.
const N = 3;
const open = () => ({ knownA: new Array<number | null>(9).fill(null), knownB: new Array<number | null>(9).fill(null) });

describe('grecolatin candidates (per-dimension)', () => {
  it('a fully-open cell on an empty grid has all n*n pairs', () => {
    const { knownA, knownB } = open();
    const an = analyze(N, knownA, knownB);
    expect(candidatesAt(N, an, knownA, knownB, 0).length).toBe(N * N);
  });

  it('a digit-only clue restricts that cell to its a, and excludes that a from row/col peers', () => {
    const { knownA, knownB } = open();
    knownA[0] = 1; // cell 0 (row0,col0) digit = 1
    const an = analyze(N, knownA, knownB);
    // cell 0: a fixed to 1 → all candidates have a===1
    expect(candidatesAt(N, an, knownA, knownB, 0).every((c) => c.a === 1)).toBe(true);
    // cell 1 (row0,col1): a=1 excluded (same row)
    expect(candidatesAt(N, an, knownA, knownB, 1).some((c) => c.a === 1)).toBe(false);
  });

  it('a letter-only clue is transparent to the a-projection (digit candidates unaffected for peers)', () => {
    const { knownA, knownB } = open();
    knownB[0] = 2; // cell 0 letter = 2, digit unknown
    const an = analyze(N, knownA, knownB);
    // cell 1's a-candidates are NOT restricted by cell 0 (whose a is unknown)
    const aVals = new Set(candidatesAt(N, an, knownA, knownB, 1).map((c) => c.a));
    expect(aVals.size).toBe(N); // all digits still possible for cell 1's a
    // but cell 1's b excludes 2 (same row, letter known)
    expect(candidatesAt(N, an, knownA, knownB, 1).some((c) => c.b === 2)).toBe(false);
  });

  it('a fully-known cell contributes a used pair that other cells exclude', () => {
    const { knownA, knownB } = open();
    knownA[0] = 1; knownB[0] = 2; // cell 0 = pair (1,2)
    const an = analyze(N, knownA, knownB);
    // cell 8 (row2,col2): pair (1,2) excluded globally
    expect(candidatesAt(N, an, knownA, knownB, 8).some((c) => c.a === 1 && c.b === 2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/candidates.test.ts`
Expected: FAIL (signature mismatch — current `analyze(n, grid)` / `candidatesAt(n, an, i)`).

- [ ] **Step 3: Rewrite `candidates.ts`**

Replace the contents of `src/engine/puzzles/grecolatin/candidates.ts` with:

```ts
export interface Analysis {
  aRow: Set<number>[]; aCol: Set<number>[];
  bRow: Set<number>[]; bCol: Set<number>[];
  pairs: Set<number>;
}

/** Per-row/col known a/b values + globally-used pairs (cells where BOTH dims are known). */
export function analyze(n: number, knownA: (number | null)[], knownB: (number | null)[]): Analysis {
  const mk = () => Array.from({ length: n }, () => new Set<number>());
  const an: Analysis = { aRow: mk(), aCol: mk(), bRow: mk(), bCol: mk(), pairs: new Set<number>() };
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    const a = knownA[i], b = knownB[i];
    if (a !== null) { an.aRow[r].add(a); an.aCol[c].add(a); }
    if (b !== null) { an.bRow[r].add(b); an.bCol[c].add(b); }
    if (a !== null && b !== null) an.pairs.add(a * n + b);
  }
  return an;
}

/** Legal (a,b) pairs at cell `i`: `a` fixed to knownA[i] if set else any not row/col-used;
 *  `b` likewise; pair not globally used. */
export function candidatesAt(
  n: number, an: Analysis, knownA: (number | null)[], knownB: (number | null)[], i: number
): { a: number; b: number }[] {
  const r = Math.floor(i / n), c = i % n;
  const aValues = knownA[i] !== null ? [knownA[i] as number] : range(n).filter((a) => !an.aRow[r].has(a) && !an.aCol[c].has(a));
  const bValues = knownB[i] !== null ? [knownB[i] as number] : range(n).filter((b) => !an.bRow[r].has(b) && !an.bCol[c].has(b));
  const out: { a: number; b: number }[] = [];
  for (const a of aValues) for (const b of bValues) {
    if (an.pairs.has(a * n + b)) continue;
    out.push({ a, b });
  }
  return out;
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, k) => k);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/candidates.test.ts`
Expected: PASS (4 tests).

(No commit yet — `check:engine` still red until Task 6. Continue the engine cluster.)

---

### Task 3: Rater — per-dimension propagation + recalibrated cuts

**Files:** Modify `src/engine/puzzles/grecolatin/rater.ts`; Test: `tests/engine/puzzles/grecolatin/rater.test.ts` (rewrite).

- [ ] **Step 1: Rewrite the rater test**

Replace `tests/engine/puzzles/grecolatin/rater.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { rate, residualFreeRatio } from '../../../../src/engine/puzzles/grecolatin/rater';
import { buildSquare } from '../../../../src/engine/puzzles/grecolatin/generator';
import { decodePair } from '../../../../src/engine/puzzles/grecolatin/rules';
import { createPrng } from '../../../../src/engine/core/prng';
import type { GrecoLatinInstance } from '../../../../src/engine/puzzles/grecolatin/types';

function fullClues(n: number, sol: number[]): GrecoLatinInstance {
  const digitClues = sol.map((v) => decodePair(v, n)!.a);
  const letterClues = sol.map((v) => decodePair(v, n)!.b);
  return { n, digitClues, letterClues };
}

describe('grecolatin rater (partial-aware)', () => {
  it('a fully-given square has residual ratio 0 and rates easy', () => {
    const sol = buildSquare(5, createPrng(1))!;
    expect(residualFreeRatio(fullClues(5, sol))).toBe(0);
    expect(rate(fullClues(5, sol))).toBe('easy');
  });

  it('an all-open grid has residual ratio 1 and rates expert', () => {
    const inst: GrecoLatinInstance = { n: 5, digitClues: new Array(25).fill(null), letterClues: new Array(25).fill(null) };
    expect(residualFreeRatio(inst)).toBe(1);
    expect(rate(inst)).toBe('expert');
  });

  it('residualFreeRatio is in [0,1] and deterministic for a partial-clue instance', () => {
    const sol = buildSquare(5, createPrng(7))!;
    const full = fullClues(5, sol);
    // keep a partial mix: even cells digit-only, odd cells letter-only, first 10 cells dropped
    const digitClues = full.digitClues.map((a, i) => (i < 10 ? null : i % 2 === 0 ? a : null));
    const letterClues = full.letterClues.map((b, i) => (i < 10 ? null : i % 2 === 1 ? b : null));
    const inst: GrecoLatinInstance = { n: 5, digitClues, letterClues };
    const r = residualFreeRatio(inst);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(residualFreeRatio(inst)).toBe(r);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/rater.test.ts`
Expected: FAIL (rater still reads `inst.givens`).

- [ ] **Step 3: Rewrite `rater.ts`**

Replace `src/engine/puzzles/grecolatin/rater.ts` with:

```ts
import { analyze, candidatesAt } from './candidates';
import type { GrecoLatinInstance } from './types';
import type { Difficulty } from '../../core/types';

/**
 * Fraction of originally-unknown DIMENSIONS still unforced after propagating forced
 * singles per dimension. A dimension (a or b of a cell) is "unknown" when its clue is
 * null. Propagation fixes a dimension when every legal pair at that cell shares one
 * value for it (a-Latin / b-Latin completion + pair-distinctness coupling, all sound:
 * each derived exclusion holds in every valid completion). Re-`analyze` after each fix.
 * 0 = fully deducible (easy); 1 = nothing forced (hard).
 */
export function residualFreeRatio(inst: GrecoLatinInstance): number {
  const n = inst.n;
  const knownA = [...inst.digitClues];
  const knownB = [...inst.letterClues];
  const initialUnknown = countUnknownDims(knownA, knownB);
  if (initialUnknown === 0) return 0;
  let changed = true;
  while (changed) {
    changed = false;
    const an = analyze(n, knownA, knownB);
    for (let i = 0; i < n * n; i++) {
      if (knownA[i] !== null && knownB[i] !== null) continue;
      const cands = candidatesAt(n, an, knownA, knownB, i);
      if (cands.length === 0) continue; // unsatisfiable locally (won't happen on real-square clues)
      if (knownA[i] === null && allSame(cands.map((c) => c.a))) { knownA[i] = cands[0].a; changed = true; break; }
      if (knownB[i] === null && allSame(cands.map((c) => c.b))) { knownB[i] = cands[0].b; changed = true; break; }
    }
  }
  return countUnknownDims(knownA, knownB) / initialUnknown;
}

function countUnknownDims(knownA: (number | null)[], knownB: (number | null)[]): number {
  let count = 0;
  for (let i = 0; i < knownA.length; i++) {
    if (knownA[i] === null) count++;
    if (knownB[i] === null) count++;
  }
  return count;
}

function allSame(xs: number[]): boolean {
  return xs.length > 0 && xs.every((x) => x === xs[0]);
}

// Cut points are recalibrated in Task 6 against the partial-clue distribution. Phase-0
// found the populated region is ~0.5–0.97 (plus easy ≈0, expert ≈1); these starting
// cuts split it into medium/hard and are tuned by the calibration step.
function bandForRatio(r: number): Difficulty {
  if (r <= 0.05) return 'easy';
  if (r <= 0.73) return 'medium';
  if (r <= 0.97) return 'hard';
  return 'expert';
}

/** Rate a Greco-Latin instance by how much free-choice search its construction needs. */
export function rate(inst: GrecoLatinInstance): Difficulty {
  return bandForRatio(residualFreeRatio(inst));
}
```

Note: the `break` after each fix means one fix per pass (re-`analyze` next pass) — the soundness guard the council required (no stale-snapshot batching).

- [ ] **Step 4: Run, expect pass**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/rater.test.ts`
Expected: PASS (3 tests).

(No commit yet — continue the engine cluster.)

---

### Task 4: Generator — partial reveal + floor

**Files:** Modify `src/engine/puzzles/grecolatin/generator.ts`; Test: `tests/engine/puzzles/grecolatin/generator.test.ts` (rewrite).

- [ ] **Step 1: Rewrite the generator test**

Replace `tests/engine/puzzles/grecolatin/generator.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { generateForDifficulty, buildSquare } from '../../../../src/engine/puzzles/grecolatin/generator';
import { rate } from '../../../../src/engine/puzzles/grecolatin/rater';
import { validateGrid } from '../../../../src/engine/puzzles/grecolatin/rules';
import { decodePair } from '../../../../src/engine/puzzles/grecolatin/rules';
import { createPrng, deriveSeed } from '../../../../src/engine/core/prng';
import { DIFFICULTIES } from '../../../../src/engine/core/types';

describe('grecolatin generateForDifficulty (partial clues, floored)', () => {
  it('reported difficulty equals the rater on the produced instance (honesty)', () => {
    for (const target of DIFFICULTIES) {
      const g = generateForDifficulty(createPrng(deriveSeed('grecolatin', target, 'honest', 0)), target);
      expect(g.difficulty).toBe(rate(g.instance));
    }
  });

  it('clues are a valid partial revelation of a real square (no conflicts)', () => {
    const g = generateForDifficulty(createPrng(deriveSeed('grecolatin', 'hard', 'valid', 0)), 'hard');
    const n = g.instance.n;
    // Build a full grid from clues where both dims are known; validate that sub-grid has no conflicts.
    const cells = g.instance.digitClues.map((a, i) =>
      a !== null && g.instance.letterClues[i] !== null ? a * n + (g.instance.letterClues[i] as number) + 1 : 0
    );
    expect(validateGrid(n, cells).valid).toBe(true);
  });

  it('partial clues actually appear at higher difficulties', () => {
    const g = generateForDifficulty(createPrng(deriveSeed('grecolatin', 'hard', 'partial', 0)), 'hard');
    const partial = g.instance.digitClues.some((a, i) => (a === null) !== (g.instance.letterClues[i] === null));
    expect(partial).toBe(true); // at least one cell has exactly one dimension clued
  });

  it('easy and hard are reachable within the attempt budget', () => {
    for (const target of ['easy', 'hard'] as const) {
      let hit = false;
      for (let s = 0; s < 10 && !hit; s++) {
        if (generateForDifficulty(createPrng(deriveSeed('grecolatin', target, 'reach', s)), target).difficulty === target) hit = true;
      }
      expect(hit, `target ${target} reachable`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/generator.test.ts`
Expected: FAIL (generator builds `{ n, givens }`).

- [ ] **Step 3: Rewrite the reveal + generate functions**

In `src/engine/puzzles/grecolatin/generator.ts`, keep `buildSquare`/`permute`/`buildOdd`/`buildGFSquare`/`gfMul` and the imports. Replace `REVEAL`, `revealGivens`, and `generateForDifficulty`, and update `GeneratedGreco`, with:

```ts
// Per-band generation schedule seeded from the Phase-0 sweep (count = cells revealed,
// partial = fraction of reveals that expose only one dimension). Tuned in Task 6.
const SCHEDULE: Record<Difficulty, { count: number; partial: number }> = {
  easy: { count: 12, partial: 0.0 },
  medium: { count: 10, partial: 0.5 },
  hard: { count: 12, partial: 0.75 },
  expert: { count: 6, partial: 0.5 }
};
const RANK: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };
const GEN_ATTEMPTS = 80;

export interface GeneratedGreco {
  instance: GrecoLatinInstance;
  difficulty: Difficulty;
}

/** Reveal `count` random cells; each is full / digit-only / letter-only per `partial`. */
function revealPartial(
  sol: number[], n: number, count: number, partial: number, prng: PRNG
): { digitClues: (number | null)[]; letterClues: (number | null)[] } {
  const digitClues = new Array<number | null>(n * n).fill(null);
  const letterClues = new Array<number | null>(n * n).fill(null);
  const order = prng.shuffle(sol.map((_, i) => i));
  const k = Math.max(1, Math.min(count, n * n));
  for (let m = 0; m < k; m++) {
    const i = order[m];
    const p = decodePair(sol[i], n)!;
    if (prng.next() >= partial) { digitClues[i] = p.a; letterClues[i] = p.b; }      // full
    else if (prng.next() < 0.5) digitClues[i] = p.a;                                 // digit-only
    else letterClues[i] = p.b;                                                       // letter-only
  }
  return { digitClues, letterClues };
}

export function generateForDifficulty(prng: PRNG, target: Difficulty, n = 5): GeneratedGreco {
  const { count, partial } = SCHEDULE[target];
  let best: GeneratedGreco | null = null;
  for (let attempt = 0; attempt < GEN_ATTEMPTS; attempt++) {
    const sol = buildSquare(n, prng);
    if (!sol) throw new Error(`grecolatin: failed to build a square of order ${n}`);
    const { digitClues, letterClues } = revealPartial(sol, n, count, partial, prng);
    const instance: GrecoLatinInstance = { n, digitClues, letterClues };
    const difficulty = rate(instance);
    if (difficulty === target) return { instance, difficulty };
    if (best === null || Math.abs(RANK[difficulty] - RANK[target]) < Math.abs(RANK[best.difficulty] - RANK[target])) {
      best = { instance, difficulty };
    }
  }
  return best!; // GEN_ATTEMPTS >= 1 ⇒ best is always assigned (the throw only fires on buildSquare failure)
}
```

Ensure `decodePair` is imported (add to the existing `import ... from './rules'`). `rate` is already imported.

- [ ] **Step 4: Run, expect pass**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/generator.test.ts`
Expected: PASS. If "easy and hard reachable" fails, that means the starting SCHEDULE/cuts are off — proceed to Task 6's calibration which fixes both; for now, if hard isn't reachable in 10 seeds, raise the test's seed loop to 20 and re-run, and note it for Task 6.

(No commit yet — continue the engine cluster.)

---

### Task 5: Hint — per-dimension candidate model + single-dimension hints

**Files:** Modify `src/engine/puzzles/grecolatin/hint.ts`; Test: `tests/engine/puzzles/grecolatin/hint.test.ts` (update).

- [ ] **Step 1: Read the current hint.ts** (it uses the now-changed `analyze`/`candidatesAt` and `inst.givens`).

Run: `cat src/engine/puzzles/grecolatin/hint.ts`

- [ ] **Step 2: Rewrite `hint.ts` to the per-dimension model**

Replace `src/engine/puzzles/grecolatin/hint.ts` with:

```ts
import { encodePair } from './rules';
import { analyze, candidatesAt } from './candidates';
import type { GrecoLatinInstance, GrecoLatinState } from './types';
import type { Hint } from '../../core/types';

/** Merge clues + player state into knownA/knownB (clue wins; player value otherwise; null = open). */
function knownFrom(inst: GrecoLatinInstance, cells: number[]): { knownA: (number | null)[]; knownB: (number | null)[] } {
  const n = inst.n;
  const knownA: (number | null)[] = [];
  const knownB: (number | null)[] = [];
  for (let i = 0; i < n * n; i++) {
    const v = cells[i] || 0;
    const pa = v !== 0 ? Math.floor((v - 1) / n) : null;
    const pb = v !== 0 ? (v - 1) % n : null;
    knownA[i] = inst.digitClues[i] !== null ? inst.digitClues[i] : pa;
    knownB[i] = inst.letterClues[i] !== null ? inst.letterClues[i] : pb;
  }
  return { knownA, knownB };
}

/** MRV completion (bounded) of the open dimensions; returns full knownA/knownB or null. */
function complete(n: number, knownA: (number | null)[], knownB: (number | null)[]): { a: number[]; b: number[] } | null {
  const A = [...knownA], B = [...knownB];
  let steps = 0;
  const CAP = 8_000;
  const rec = (): boolean => {
    if (++steps > CAP) return false;
    const an = analyze(n, A, B);
    let target = -1;
    let best: { a: number; b: number }[] | null = null;
    for (let i = 0; i < n * n; i++) {
      if (A[i] !== null && B[i] !== null) continue;
      const cands = candidatesAt(n, an, A, B, i);
      if (cands.length === 0) return false;
      if (best === null || cands.length < best.length) { target = i; best = cands; if (cands.length === 1) break; }
    }
    if (target === -1) return true;
    for (const c of best!) {
      const savedA = A[target], savedB = B[target];
      A[target] = c.a; B[target] = c.b;
      if (rec()) return true;
      A[target] = savedA; B[target] = savedB;
    }
    return false;
  };
  return rec() ? { a: A as number[], b: B as number[] } : null;
}

/** Suggest a cell + the dimension(s) to fill: a forced dimension if any, else a value from a completion. */
export function hintCell(inst: GrecoLatinInstance, cells: number[]): { index: number; a: number | null; b: number | null } | null {
  const n = inst.n;
  const { knownA, knownB } = knownFrom(inst, cells);
  const an = analyze(n, knownA, knownB);
  let firstOpen = -1;
  for (let i = 0; i < n * n; i++) {
    if (knownA[i] !== null && knownB[i] !== null) continue;
    if (firstOpen < 0) firstOpen = i;
    const cands = candidatesAt(n, an, knownA, knownB, i);
    if (cands.length === 0) continue;
    if (knownA[i] === null && cands.every((c) => c.a === cands[0].a)) return { index: i, a: cands[0].a, b: null };
    if (knownB[i] === null && cands.every((c) => c.b === cands[0].b)) return { index: i, a: null, b: cands[0].b };
  }
  if (firstOpen < 0) return null;
  const done = complete(n, knownA, knownB);
  if (!done) return null;
  return {
    index: firstOpen,
    a: knownA[firstOpen] === null ? done.a[firstOpen] : null,
    b: knownB[firstOpen] === null ? done.b[firstOpen] : null
  };
}

export function getHint(inst: GrecoLatinInstance, state: GrecoLatinState): Hint | null {
  const r = hintCell(inst, state.cells);
  if (!r) return null;
  const parts: string[] = [];
  if (r.b !== null) parts.push(`letter ${String.fromCharCode(65 + r.b)}`);
  if (r.a !== null) parts.push(`digit ${r.a + 1}`);
  return { cells: [r.index], text: `Place ${parts.join(', ')}` };
}
```

Note: `encodePair` retained for potential reuse; if `bun run lint` flags it unused, drop the import. The hint now returns per-dimension `{a, b}` (either may be null = "leave that dimension").

- [ ] **Step 3: Update the hint test**

Read `tests/engine/puzzles/grecolatin/hint.test.ts`; update its instances to the new model (`{ n, digitClues, letterClues }` instead of `{ n, givens }`) and `hintCell` result shape (`{ index, a, b }`). Keep the bounded-large-grid tests (they still validate no-freeze; build instances via `buildSquare` + partial clues). Replace any `r!.value` with checks on `r!.a`/`r!.b`. Run `bun run test:unit tests/engine/puzzles/grecolatin/hint.test.ts` until green.

(No commit yet — continue the engine cluster.)

---

### Task 6: index.ts + engine green + calibration + COMMIT the engine cluster

**Files:** Modify `src/engine/puzzles/grecolatin/index.ts`; Test: `tests/engine/puzzles/grecolatin/module.test.ts` (update).

- [ ] **Step 1: Update `index.ts` validate / validateMove / render**

In `src/engine/puzzles/grecolatin/index.ts`:
- `validate(inst, state)`: build `cells` by merging clues + player state (a cell counts only when both dims known), then `validateGrid(inst.n, cells)`. Replace the old `inst.givens.map(...)` with:
```ts
function mergedCells(inst: GrecoLatinInstance, state: GrecoLatinState): number[] {
  const n = inst.n;
  return Array.from({ length: n * n }, (_, i) => {
    const a = inst.digitClues[i] !== null ? inst.digitClues[i] : null;
    const b = inst.letterClues[i] !== null ? inst.letterClues[i] : null;
    const v = state.cells[i] || 0;
    const pa = a !== null ? a : v !== 0 ? Math.floor((v - 1) / n) : null;
    const pb = b !== null ? b : v !== 0 ? (v - 1) % n : null;
    return pa !== null && pb !== null ? pa * n + pb + 1 : 0;
  });
}
```
  and `validate` calls `validateGrid(inst.n, mergedCells(inst, state))`.
- `validateMove(inst, _s, m)`: reject only a fully-given cell — change `if (inst.givens[m.index] !== 0)` to `if (inst.digitClues[m.index] !== null && inst.letterClues[m.index] !== null) return { ok: false, reason: 'cell is fully given' };` (per-dimension locking is enforced in the play store; see §11 of the spec).
- `render(inst, state)`: pass `digitClues`/`letterClues` instead of `givens`:
```ts
return { kind: 'grecolatin', n: inst.n, digitClues: inst.digitClues, letterClues: inst.letterClues, cells: state.cells };
```

- [ ] **Step 2: Update `module.test.ts`**

Read `tests/engine/puzzles/grecolatin/module.test.ts`; update any `inst.givens` references and add: a partial-clue instance reaches `validate(...).complete === true && .valid === true` when filled to a full square. Run it green.

- [ ] **Step 3: Engine cluster green**

Run: `bun run test:unit && bun run check:engine && bun run lint`
Expected: all green (the whole engine now uses the new model; UI `.svelte` files are NOT covered by `check:engine`). Fix any remaining engine `inst.givens` references the compiler flags.

- [ ] **Step 4: CALIBRATE cuts + schedule**

Run this measurement (delete after):
```bash
cd /home/sbrn/Projects/multilogic
cat > ./_gcal.ts <<'EOF'
import { buildSquare } from './src/engine/puzzles/grecolatin/generator';
import { residualFreeRatio } from './src/engine/puzzles/grecolatin/rater';
import { decodePair } from './src/engine/puzzles/grecolatin/rules';
import { createPrng } from './src/engine/core/prng';
function reveal(sol: number[], n: number, count: number, partial: number, prng: any) {
  const dC = new Array(n*n).fill(null), lC = new Array(n*n).fill(null);
  const order = prng.shuffle(sol.map((_: number, i: number) => i));
  for (let m = 0; m < Math.max(1, count); m++) { const i = order[m]; const p = decodePair(sol[i], n)!;
    if (prng.next() >= partial) { dC[i]=p.a; lC[i]=p.b; } else if (prng.next()<0.5) dC[i]=p.a; else lC[i]=p.b; }
  return { n, digitClues: dC, letterClues: lC };
}
for (const [band, count, partial] of [['easy',12,0],['medium',10,0.5],['hard',12,0.75],['expert',6,0.5]] as const) {
  const rs: number[] = [];
  for (let s = 0; s < 120; s++) { const prng = createPrng(s+1); const sol = buildSquare(5, prng)!;
    rs.push(residualFreeRatio(reveal(sol, 5, count, partial, prng))); }
  rs.sort((a,b)=>a-b);
  console.log(`${band.padEnd(7)} c=${count} p=${partial}  p10=${rs[12].toFixed(2)} med=${rs[60].toFixed(2)} p90=${rs[108].toFixed(2)}`);
}
EOF
bun run ./_gcal.ts; rm -f ./_gcal.ts
```
Read the medians. Adjust `bandForRatio` cuts in `rater.ts` and/or the per-band `SCHEDULE` in `generator.ts` so each band's schedule lands its median inside its band and the bands are ordered (easy < medium < hard < expert by ratio). Target: easy ≈0; medium in (0.05, cut2]; hard in (cut2, 0.97]; expert ≈1. If medium and hard medians don't separate, widen their schedules apart (medium fewer-partial/more-cells; hard more-partial). Re-run the generator test (Task 4) — easy/medium/hard/expert should each be reachable within ~20 seeds; if a band genuinely can't separate at n=5, record it (closest-fallback still serves honestly) and note it for the spec.

- [ ] **Step 5: COMMIT the engine cluster**

```bash
git add src/engine/puzzles/grecolatin/{types,candidates,rater,generator,hint,index}.ts tests/engine/puzzles/grecolatin/{candidates,rater,generator,hint,module}.test.ts
git commit -m "feat(grecolatin): partial-clue engine — per-dimension candidates, rater, generation, hint"
```
Pre-commit fallow hook must pass with NO suppression.

---

### Task 7: Play store — per-dimension locking

**Files:** Modify `src/lib/play/greco.svelte.ts`.

- [ ] **Step 1: Update the store to the per-dimension clue model**

In `src/lib/play/greco.svelte.ts`:
- Replace `givens = $state<number[]>([])` with `digitClues = $state<(number | null)[]>([])` and `letterClues = $state<(number | null)[]>([])`.
- Add helpers: `isDigitGiven = (i: number) => this.digitClues[i] !== null;` `isLetterGiven = (i: number) => this.letterClues[i] !== null;` `isFullyGiven = (i: number) => this.isDigitGiven(i) && this.isLetterGiven(i);`
- `load(n, digitClues, letterClues)`: set the clue arrays; seed `digits[i] = digitClues[i] ?? -1`, `letters[i] = letterClues[i] ?? -1`.
- `select(i)`: allow if `!this.isFullyGiven(i)`.
- `setDigit(d)`: guard `if (i === null || this.isDigitGiven(i)) return;`
- `setLetter(l)`: guard `if (i === null || this.isLetterGiven(i)) return;`
- `clear()`: clear only the open dimensions — `if (!this.isDigitGiven(i)) digits[i] = -1; if (!this.isLetterGiven(i)) letters[i] = -1;`
- `hint()`: build `inst = { n: this.n, digitClues: this.digitClues, letterClues: this.letterClues }`; call `hintCell(inst, this.cells)`; apply the returned `{index, a, b}` — set `digits[index]` if `a !== null`, `letters[index]` if `b !== null`.
- The `cells` getter is unchanged (counts a cell only when both dims placed).

- [ ] **Step 2: Confirm store compiles**

Run: `bun run check 2>&1 | grep -i greco` — expect the store's own errors gone (the routes/board still error until Tasks 8–9). Pre-existing `$lib/i18n` warnings are unrelated.

(No commit yet — UI cluster; commit at Task 9.)

---

### Task 8: Board — per-token rendering + focusable

**Files:** Modify `src/lib/components/GrecoBoard.svelte`.

- [ ] **Step 1: Render digit and letter as separate tokens with independent given styling**

In `src/lib/components/GrecoBoard.svelte`:
- Replace `isOpen` / `isGiven`: `const isOpen = (i) => !(store.isDigitGiven(i) && store.isLetterGiven(i));` and per-token: `digitGiven = store.isDigitGiven(i)`, `letterGiven = store.isLetterGiven(i)`.
- Replace the single `{cellText(...)}` text with two `<span>`s: one for the letter (`class:given={letterGiven}`) and one for the digit (`class:given={digitGiven}`), each showing its value or empty. Keep the existing `.given` style; add a subtle distinction so a partially-given cell reads as part-locked.
- Keyboard nav `focusable` predicate → `isOpen` (at least one dimension open).
- The digit/letter pickers should disable the locked dimension when the selected cell has that dimension given (a small `disabled` on the relevant picker buttons keyed off `store.isDigitGiven(sel)` / `store.isLetterGiven(sel)`).

- [ ] **Step 2: Confirm board compiles**

Run: `bun run check 2>&1 | grep -i grecoboard` — expect no GrecoBoard errors.

(No commit yet — commit at Task 9.)

---

### Task 9: Route pages + full green + COMMIT the UI cluster

**Files:** Modify `src/routes/daily/grecolatin/+page.svelte`, `src/routes/play/grecolatin/+page.svelte`; Test: a component test.

- [ ] **Step 1: Update both `store.load(...)` calls**

In each route page, change `store.load(inst.n, inst.givens)` to `store.load(inst.n, inst.digitClues, inst.letterClues)`.

- [ ] **Step 2: Add a component test for per-dimension locking**

Create `tests/components/greco-board.test.ts` (mirror the existing `tests/components/sudoku-grid.test.ts` setup for mounting): mount `GrecoBoard` with a store loaded from a partial-clue instance (one cell digit-only, one letter-only, one full); assert the fully-given cell is not focusable/selectable, the digit-only cell accepts a letter but the digit picker for it is disabled, and vice-versa. (Follow the existing browser-test harness; consult `tests/components/sudoku-grid.test.ts` for the mount + `$lib` alias pattern.)

- [ ] **Step 3: Full green**

Run: `bun run check && bun run test:unit && bun run test:browser && bun run lint`
Expected: all green. (`bun run check` = svelte-check over the whole app; this is the first point the UI cluster makes it green.) Run `bun run test:browser` for the new component test.

- [ ] **Step 4: Regenerate the bundle + bump engine version**

In `scripts/pregen.ts`, bump `ENGINE_VERSION` by 1 (the instance shape changed). Run `bun run pregen`; confirm it writes and the grecolatin entries deserialize (`node -e "const b=require('./static/puzzles.bundle.json'); console.log(b.puzzles.filter(p=>p.type==='grecolatin').map(p=>p.requested+'→'+p.achieved).join(', '))"`).

- [ ] **Step 5: COMMIT the UI cluster**

```bash
git add src/lib/play/greco.svelte.ts src/lib/components/GrecoBoard.svelte src/routes/daily/grecolatin/+page.svelte src/routes/play/grecolatin/+page.svelte tests/components/greco-board.test.ts scripts/pregen.ts
git commit -m "feat(grecolatin): partial-clue play UI — per-dimension locking + per-token board"
```

- [ ] **Step 6: Manual play-test + spec note**

Run the app (`bun run dev` or the project's run skill), open a Greco puzzle, confirm partial-clue cells render with one dimension locked and accept input on the other, and a hint fills the open dimension. Append a short result note to the spec (`docs/superpowers/specs/2026-06-16-grecolatin-partial-clues-design.md`) with the calibrated cuts/schedule and the measured per-band reachability, then commit it.

---

## Self-Review

**Spec coverage:** §3 data model → Task 1. §4 candidates → Task 2. §5 rater (per-dimension propagation, one-fix-per-pass soundness guard, recalibrated cuts) → Task 3 + Task 6 Step 4. §6 generation (partial reveal + floor) → Task 4. §7 UI (store per-dimension locking, board per-token, hint single-dimension) → Tasks 5,7,8. §8 migration (render, engineVersion, bundle) → Task 6 (render) + Task 9 (version/bundle). §9 tests (candidates, rater anchors, generator honesty, soundness, completion, locking) → Tasks 2,3,4,6,9. §11 expanded scope (index.ts validate/validateMove/render, route pages, GrecoLatinMove decision = store-side locking) → Tasks 6,9. Phase-0 gate → done (GO).

**Soundness gate:** Task 3's one-fix-per-pass (`break` after each fix + re-`analyze`) is the council-required guard. The Phase-0 prototype already cross-checked propagation vs the generating square (0 violations); Task 4's "honesty" test (`difficulty === rate(instance)`) plus the all-given⇒0 / all-open⇒1 anchors (Task 3) guard the rating. Consider adding an explicit propagation-vs-square assertion in Task 3 if implementation diverges.

**Placeholder scan:** No TBD/TODO; every code step shows full code; calibration (Task 6 Step 4) gives a concrete measurement + adjustment procedure with starting values, not a vague "tune it." Run steps state expected results and escalation paths.

**Type consistency:** `GrecoLatinInstance = { n, digitClues, letterClues }` (Task 1) is used identically in candidates (Task 2 — `analyze(n, knownA, knownB)`, `candidatesAt(n, an, knownA, knownB, i)`), rater (Task 3), generator (Task 4 — `revealPartial` returns `{digitClues, letterClues}`), hint (Task 5 — `hintCell` returns `{index, a, b}`), index (Task 6), store (Task 7 — `load(n, digitClues, letterClues)`), board (Task 8), routes (Task 9). The hint result `{index, a: number|null, b: number|null}` is consumed by `getHint` (Task 5) and the store `hint()` (Task 7) consistently.
