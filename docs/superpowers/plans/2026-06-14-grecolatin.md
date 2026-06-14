# Greco-Latin Squares (Construction Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Add Greco-Latin squares as the fourth puzzle — a **construction** puzzle (place (symbol, colour) pairs so each row and column is Latin in both projections and all pairs are distinct). No uniqueness; scored on validity + completion. Orders n ∈ {3,4,5,7,8,9} (n=6 excluded — no Greco-Latin square of order 6 exists).

**Architecture:** A `ConstructionPuzzle` engine module under `src/engine/puzzles/grecolatin/`. A cell value encodes a pair (a,b) as `a*n+b+1` (0 = empty). The engine generates a valid Greco-Latin square (direct cyclic construction for odd n; backtracking search for even n; seeded permutation for variety), reveals a fraction of cells as givens by difficulty, and `validate()` scores the player's grid (both projections Latin + pairs distinct, among filled cells). Because pairs don't fit the digit-based `PlayableGame`, Greco-Latin gets its **own** play route `/play/grecolatin` with a dedicated board (symbol + colour pickers). It registers in the engine `MODULES` (the generic worker already handles any module via the seam).

**Tech Stack:** TypeScript, Bun, Vitest, Svelte 5, Playwright.

---

## Task 1: types + rules

**Files:** `src/engine/puzzles/grecolatin/types.ts`, `rules.ts`; Test `tests/engine/puzzles/grecolatin/rules.test.ts`

- [ ] **Step 1: Failing tests** — `tests/engine/puzzles/grecolatin/rules.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { encodePair, decodePair, validateGrid, VALID_ORDERS, serializeInstance, deserializeInstance } from '../../../../src/engine/puzzles/grecolatin/rules';

describe('grecolatin rules', () => {
  it('valid orders exclude 2 and 6', () => {
    expect(VALID_ORDERS).toEqual([3, 4, 5, 7, 8, 9]);
  });
  it('encode/decode pairs round-trip (1-based, 0 = empty)', () => {
    expect(encodePair(0, 0, 3)).toBe(1);
    expect(encodePair(2, 1, 3)).toBe(8); // 2*3+1+1
    expect(decodePair(8, 3)).toEqual({ a: 2, b: 1 });
    expect(decodePair(0, 3)).toBeNull();
  });
  it('validateGrid: a valid complete order-3 square scores 1 and is valid', () => {
    // direct construction n=3: a=(i+j)%3, b=(i+2j)%3
    const n = 3;
    const cells: number[] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cells.push(encodePair((i + j) % n, (i + 2 * j) % n, n));
    const r = validateGrid(n, cells);
    expect(r.complete).toBe(true);
    expect(r.valid).toBe(true);
    expect(r.score).toBe(1);
    expect(r.conflicts.size).toBe(0);
  });
  it('validateGrid: a row with a repeated symbol flags a conflict', () => {
    const n = 3;
    const cells = new Array(9).fill(0);
    cells[0] = encodePair(0, 0, n); // (0,0)
    cells[1] = encodePair(0, 1, n); // (0,1) — same a=0 in row 0 → a-projection conflict
    const r = validateGrid(n, cells);
    expect(r.valid).toBe(false);
    expect(r.conflicts.has(0)).toBe(true);
    expect(r.conflicts.has(1)).toBe(true);
    expect(r.complete).toBe(false);
  });
  it('validateGrid: duplicate pair flags a conflict', () => {
    const n = 3;
    const cells = new Array(9).fill(0);
    cells[0] = encodePair(0, 0, n);
    cells[8] = encodePair(0, 0, n); // same pair elsewhere (not same row/col) → pair-distinctness conflict
    const r = validateGrid(n, cells);
    expect(r.valid).toBe(false);
    expect(r.conflicts.has(0)).toBe(true);
    expect(r.conflicts.has(8)).toBe(true);
  });
  it('serialize/deserialize round-trips', () => {
    const inst = { n: 5, givens: new Array(25).fill(0) };
    expect(deserializeInstance(serializeInstance(inst))).toEqual(inst);
  });
});
```

- [ ] **Step 2: Run** `bun run test -- grecolatin/rules` (FAIL).

- [ ] **Step 3: Implement** `src/engine/puzzles/grecolatin/types.ts`:
```ts
export interface GrecoLatinInstance {
  n: number;          // order; valid orders are 3,4,5,7,8,9
  givens: number[];   // length n*n; 0 = empty; else encoded pair a*n+b+1
}
export type GrecoLatinSolution = null; // construction puzzle — no fixed solution to match
export interface GrecoLatinState { cells: number[] }
export interface GrecoLatinMove { index: number; value: number } // encoded pair, or 0 to clear
```

`src/engine/puzzles/grecolatin/rules.ts`:
```ts
import type { GrecoLatinInstance } from './types';

export const VALID_ORDERS = [3, 4, 5, 7, 8, 9];

export function encodePair(a: number, b: number, n: number): number {
  return a * n + b + 1;
}
export function decodePair(v: number, n: number): { a: number; b: number } | null {
  if (v === 0) return null;
  const c = v - 1;
  return { a: Math.floor(c / n), b: c % n };
}

export interface ValidationResult {
  complete: boolean;
  valid: boolean;
  score: number;
  conflicts: Set<number>;
}

/** Validate a (possibly partial) grid: rows & cols Latin in both projections + globally distinct pairs. */
export function validateGrid(n: number, cells: number[]): ValidationResult {
  const total = n * n;
  const conflicts = new Set<number>();
  const A = new Array<number>(total).fill(-1);
  const B = new Array<number>(total).fill(-1);
  let filled = 0;
  for (let i = 0; i < total; i++) {
    if (cells[i] !== 0) {
      filled++;
      const p = decodePair(cells[i], n)!;
      A[i] = p.a;
      B[i] = p.b;
    }
  }
  const flagDups = (idxs: number[]) => {
    for (const proj of [A, B]) {
      const seen = new Map<number, number[]>();
      for (const i of idxs) {
        if (proj[i] < 0) continue;
        const g = seen.get(proj[i]);
        if (g) g.push(i); else seen.set(proj[i], [i]);
      }
      for (const g of seen.values()) if (g.length > 1) for (const i of g) conflicts.add(i);
    }
  };
  for (let r = 0; r < n; r++) flagDups(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) flagDups(Array.from({ length: n }, (_, r) => r * n + c));
  // global pair distinctness
  const pairSeen = new Map<number, number[]>();
  for (let i = 0; i < total; i++) {
    if (cells[i] === 0) continue;
    const g = pairSeen.get(cells[i]);
    if (g) g.push(i); else pairSeen.set(cells[i], [i]);
  }
  for (const g of pairSeen.values()) if (g.length > 1) for (const i of g) conflicts.add(i);

  return { complete: filled === total, valid: conflicts.size === 0, score: filled / total, conflicts };
}

export function serializeInstance(inst: GrecoLatinInstance): string { return JSON.stringify(inst); }
export function deserializeInstance(s: string): GrecoLatinInstance { return JSON.parse(s) as GrecoLatinInstance; }
export function serializeSolution(): string { return ''; }      // construction: no solution payload
export function deserializeSolution(): null { return null; }
```

- [ ] **Step 4–6:** tests PASS, check:engine 0, lint 0. Commit `feat(grecolatin): types + rules (pair encode, validate)`.

---

## Task 2: generator

**Files:** `src/engine/puzzles/grecolatin/generator.ts`; Test `tests/engine/puzzles/grecolatin/generator.test.ts`

- [ ] **Step 1: Failing tests** — `tests/engine/puzzles/grecolatin/generator.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSquare, generateForDifficulty } from '../../../../src/engine/puzzles/grecolatin/generator';
import { validateGrid } from '../../../../src/engine/puzzles/grecolatin/rules';
import { createPrng } from '../../../../src/engine/core/prng';

describe('grecolatin generator', () => {
  it('buildSquare yields a valid complete Greco-Latin square for each valid order', () => {
    for (const n of [3, 4, 5, 7, 8, 9]) {
      const sq = buildSquare(n, createPrng('s' + n));
      expect(sq).not.toBeNull();
      const r = validateGrid(n, sq!);
      expect(r.complete).toBe(true);
      expect(r.valid).toBe(true);
    }
  });
  it('buildSquare is deterministic for a seed', () => {
    expect(buildSquare(5, createPrng('z'))).toEqual(buildSquare(5, createPrng('z')));
  });
  it('generateForDifficulty produces givens that are a subset of a valid square', () => {
    const g = generateForDifficulty(createPrng('g1'), 'easy', 5);
    expect(g.instance.n).toBe(5);
    // the givens alone must be conflict-free (they come from a valid square)
    expect(validateGrid(5, g.instance.givens).valid).toBe(true);
    const filled = g.instance.givens.filter((v) => v !== 0).length;
    expect(filled).toBeGreaterThan(0);
    expect(filled).toBeLessThan(25);
  });
  it('easy reveals more givens than hard', () => {
    const easy = generateForDifficulty(createPrng('a'), 'easy', 5).instance.givens.filter((v) => v !== 0).length;
    const hard = generateForDifficulty(createPrng('a'), 'hard', 5).instance.givens.filter((v) => v !== 0).length;
    expect(easy).toBeGreaterThan(hard);
  });
});
```

- [ ] **Step 2: Run** (FAIL).

- [ ] **Step 3: Implement** `src/engine/puzzles/grecolatin/generator.ts`:
```ts
import { encodePair, decodePair } from './rules';
import type { PRNG } from '../../core/prng';
import type { Difficulty } from '../../core/types';
import type { GrecoLatinInstance } from './types';

/** Backtracking search for a Greco-Latin square (used for even orders). */
function searchSquare(n: number, prng: PRNG): number[] | null {
  const a = new Array<number>(n * n).fill(-1);
  const b = new Array<number>(n * n).fill(-1);
  const aRow = Array.from({ length: n }, () => new Set<number>());
  const aCol = Array.from({ length: n }, () => new Set<number>());
  const bRow = Array.from({ length: n }, () => new Set<number>());
  const bCol = Array.from({ length: n }, () => new Set<number>());
  const pairUsed = new Set<number>();
  const rec = (idx: number): boolean => {
    if (idx === n * n) return true;
    const i = Math.floor(idx / n);
    const j = idx % n;
    for (const av of prng.shuffle(Array.from({ length: n }, (_, k) => k))) {
      if (aRow[i].has(av) || aCol[j].has(av)) continue;
      for (const bv of prng.shuffle(Array.from({ length: n }, (_, k) => k))) {
        if (bRow[i].has(bv) || bCol[j].has(bv)) continue;
        const pair = av * n + bv;
        if (pairUsed.has(pair)) continue;
        a[idx] = av; b[idx] = bv;
        aRow[i].add(av); aCol[j].add(av); bRow[i].add(bv); bCol[j].add(bv); pairUsed.add(pair);
        if (rec(idx + 1)) return true;
        aRow[i].delete(av); aCol[j].delete(av); bRow[i].delete(bv); bCol[j].delete(bv); pairUsed.delete(pair);
        a[idx] = -1; b[idx] = -1;
      }
    }
    return false;
  };
  if (!rec(0)) return null;
  return a.map((av, idx) => encodePair(av, b[idx], n));
}

/** A valid Greco-Latin square, seeded. Odd orders use the direct cyclic construction
 *  (a=(i+j)%n, b=(i+2j)%n — valid since 2 is invertible mod odd n); even orders search. */
export function buildSquare(n: number, prng: PRNG): number[] | null {
  let sol: number[] | null;
  if (n % 2 === 1) {
    sol = new Array<number>(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sol[i * n + j] = encodePair((i + j) % n, (i + 2 * j) % n, n);
  } else {
    sol = searchSquare(n, prng);
  }
  if (!sol) return null;
  return permute(sol, n, prng);
}

/** Apply random row/col permutations + independent relabelling of both symbols (preserves GL property). */
function permute(sol: number[], n: number, prng: PRNG): number[] {
  const rowPerm = prng.shuffle(Array.from({ length: n }, (_, k) => k));
  const colPerm = prng.shuffle(Array.from({ length: n }, (_, k) => k));
  const aMap = prng.shuffle(Array.from({ length: n }, (_, k) => k));
  const bMap = prng.shuffle(Array.from({ length: n }, (_, k) => k));
  const out = new Array<number>(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const src = sol[rowPerm[i] * n + colPerm[j]];
      const p = decodePair(src, n)!;
      out[i * n + j] = encodePair(aMap[p.a], bMap[p.b], n);
    }
  }
  return out;
}

const REVEAL: Record<Difficulty, number> = { easy: 0.6, medium: 0.45, hard: 0.3, expert: 0.2 };

export interface GeneratedGreco { instance: GrecoLatinInstance; difficulty: Difficulty }

export function generateForDifficulty(prng: PRNG, target: Difficulty, n = 5): GeneratedGreco {
  const sol = buildSquare(n, prng);
  if (!sol) throw new Error(`grecolatin: failed to build a square of order ${n}`);
  const givens = new Array<number>(n * n).fill(0);
  const order = prng.shuffle(sol.map((_, i) => i));
  const count = Math.max(1, Math.round(n * n * REVEAL[target]));
  for (let k = 0; k < count; k++) givens[order[k]] = sol[order[k]];
  return { instance: { n, givens }, difficulty: target };
}
```

- [ ] **Step 4–6:** tests PASS (the n=8/9 search/permute should be fast — report timing), full `bun run test`, check:engine 0, lint 0. Commit `feat(grecolatin): GL-square generator (odd direct / even search + givens)`.

---

## Task 3: construction module + registry + pregen integration

**Files:** `src/engine/puzzles/grecolatin/index.ts`; modify `src/engine/puzzles/registry.ts`, `scripts/pregen.ts` + `tests/scripts/pregen.test.ts`; Test `tests/engine/puzzles/grecolatin/module.test.ts`

- [ ] **Step 1: Failing tests** — `tests/engine/puzzles/grecolatin/module.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { grecolatin } from '../../../../src/engine/puzzles/grecolatin/index';
import { getModule } from '../../../../src/engine/puzzles/registry';
import { validateGrid } from '../../../../src/engine/puzzles/grecolatin/rules';
import { createPrng } from '../../../../src/engine/core/prng';

function sig(): AbortSignal { return new AbortController().signal; }

describe('grecolatin module', () => {
  it('is a registered construction puzzle with the seam', () => {
    expect(grecolatin.type).toBe('grecolatin');
    expect(grecolatin.kind).toBe('construction');
    expect(getModule('grecolatin').type).toBe('grecolatin');
    expect(typeof grecolatin.serializeInstance).toBe('function');
  });
  it('generate yields conflict-free givens and round-trips serialization', async () => {
    const res = await grecolatin.generate({ difficulty: 'easy', prng: createPrng('m1'), signal: sig() });
    expect(validateGrid(res.instance.n, res.instance.givens).valid).toBe(true);
    expect(grecolatin.deserializeInstance(grecolatin.serializeInstance(res.instance))).toEqual(res.instance);
    expect(res.solution).toBeNull();
  });
  it('validate scores a partial vs complete grid', async () => {
    const res = await grecolatin.generate({ difficulty: 'easy', prng: createPrng('m2'), signal: sig() });
    const partial = grecolatin.validate(res.instance, { cells: res.instance.givens });
    expect(partial.complete).toBe(false);
    expect(partial.valid).toBe(true);
    expect(partial.score).toBeGreaterThan(0);
  });
  it('validateMove rejects given cells and out-of-range pair codes', async () => {
    const res = await grecolatin.generate({ difficulty: 'easy', prng: createPrng('m3'), signal: sig() });
    const n = res.instance.n;
    const givenIdx = res.instance.givens.findIndex((v) => v !== 0);
    const emptyIdx = res.instance.givens.findIndex((v) => v === 0);
    const state = { cells: [...res.instance.givens] };
    expect(grecolatin.validateMove(res.instance, state, { index: givenIdx, value: 1 }).ok).toBe(false);
    expect(grecolatin.validateMove(res.instance, state, { index: emptyIdx, value: n * n + 1 }).ok).toBe(false);
    expect(grecolatin.validateMove(res.instance, state, { index: emptyIdx, value: 1 }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run** (FAIL).

- [ ] **Step 3: Implement** `src/engine/puzzles/grecolatin/index.ts`:
```ts
import type { ConstructionPuzzle, GenArgs, GenResult, MoveResult, RenderModel, ConstructionResult } from '../../core/types';
import type { GrecoLatinInstance, GrecoLatinState, GrecoLatinMove, GrecoLatinSolution } from './types';
import { validateGrid, serializeInstance, deserializeInstance, serializeSolution, deserializeSolution } from './rules';
import { generateForDifficulty } from './generator';

function validate(inst: GrecoLatinInstance, state: GrecoLatinState): ConstructionResult {
  const grid = inst.givens.map((g, i) => (g !== 0 ? g : state.cells[i] || 0));
  const r = validateGrid(inst.n, grid);
  return { complete: r.complete, valid: r.valid, score: r.score };
}

function validateMove(inst: GrecoLatinInstance, _s: GrecoLatinState, m: GrecoLatinMove): MoveResult {
  if (m.index < 0 || m.index >= inst.n * inst.n) return { ok: false, reason: 'index out of range' };
  if (inst.givens[m.index] !== 0) return { ok: false, reason: 'cell is a given' };
  if (m.value !== 0 && (m.value < 1 || m.value > inst.n * inst.n)) return { ok: false, reason: 'invalid pair' };
  return { ok: true };
}

function render(inst: GrecoLatinInstance, state: GrecoLatinState): RenderModel {
  return { kind: 'grecolatin', n: inst.n, givens: inst.givens, cells: state.cells };
}

export const grecolatin: ConstructionPuzzle<GrecoLatinInstance, GrecoLatinState, GrecoLatinMove> = {
  type: 'grecolatin',
  kind: 'construction',
  async generate(args: GenArgs): Promise<GenResult<GrecoLatinInstance, GrecoLatinSolution>> {
    if (args.signal.aborted) throw new Error('generation aborted');
    const g = generateForDifficulty(args.prng, args.difficulty);
    return { instance: g.instance, solution: null, achievedDifficulty: g.difficulty, source: 'live' };
  },
  validate,
  validateMove,
  render,
  serializeInstance,
  deserializeInstance,
  serializeSolution,
  deserializeSolution
};
```
> If TypeScript complains that `ConstructionPuzzle` requires specific `Solution`/method shapes, align with the existing `ConstructionPuzzle` definition in `src/engine/core/types.ts` (it extends `PuzzleBase<Instance, State, Move, null>` — so `serializeSolution(solution: null): string` and `deserializeSolution(s): null`; the rules' `serializeSolution()`/`deserializeSolution()` ignore args, which is assignable). If the seam signatures don't line up, adjust the rules' solution (de)serializers to match the exact `PuzzleBase` signatures.

- [ ] **Step 4:** Register in `src/engine/puzzles/registry.ts`: import `grecolatin`, set `grecolatin` (replace `undefined`). Update `tests/engine/puzzles/registry.test.ts` if it asserted grecolatin is unimplemented (change the "throws for unimplemented" test to a still-missing type or remove it; all four are now defined — assert `getModule('grecolatin').kind === 'construction'`).

- [ ] **Step 5:** Update `scripts/pregen.ts` + `tests/scripts/pregen.test.ts` for the construction kind: the pregen bundle now includes grecolatin entries; the bundle test currently checks uniqueness via `getModule(p.type).solveComplete` — construction modules have NO `solveComplete`, so guard it: only run the uniqueness check when `getModule(p.type).kind === 'deduction'`. For grecolatin entries, instead assert the instance deserializes and `kind === 'construction'`. Confirm `bun run pregen` still completes and emits grecolatin entries.

- [ ] **Step 6:** `bun run test` (all pass), check:engine 0, lint 0. Commit `feat(grecolatin): construction module + registry + pregen`.

---

## Task 4: dedicated play UI

**Use `svelte:svelte-file-editor`. Verify by build.**

**Files:** `src/lib/play/greco.svelte.ts` (a small runes store), `src/lib/components/GrecoBoard.svelte`, `src/routes/play/grecolatin/+page.svelte`; modify `src/routes/+page.svelte` (picker link) and `src/routes/play/grecolatin/+page.ts` (`prerender=false`).

Greco-Latin does NOT use the digit-based `PlayableGame`/generic route — it has its own surface.

- [ ] **Step 1:** `src/routes/play/grecolatin/+page.ts`: `export const prerender = false;` (dynamic, client-generated).
- [ ] **Step 2:** `src/lib/play/greco.svelte.ts` — a runes store: holds `n`, `givens`, `cells` (`$state`), `selected`, `selSymbol`/`selColour` ($state, the currently chosen pair components), `elapsedMs` + timer. Methods: `load(n, givens)`, `place(index)` (set cells[index] = encodePair(selSymbol, selColour, n) if not a given), `clear(index)`, plus `result` derived via the engine `validateGrid(n, cells-overlaid-with-givens)`. Use the engine `encodePair`/`validateGrid` from `grecolatin/rules`. Keep a `tick` or rely on `$state` arrays reassigned on mutation for reactivity.
- [ ] **Step 3:** `src/lib/components/GrecoBoard.svelte` — render an `n×n` grid. Each cell shows its pair as a **symbol** (the letter/number `a+1`) on a **colour** background (one of n distinct colours indexed by `b`). Givens are styled distinctly (e.g., bold/locked) and not editable. Selected cell highlighted; conflict cells (from `validateGrid().conflicts`) highlighted red-outline. Two picker rows below: **symbols** `1..n` and **colours** (n swatches); selecting a cell + a symbol + a colour places the pair (or place on cell click using the current selected symbol/colour). Provide an "erase" for the selected non-given cell. Show a **validity/score meter** ("12/25 placed · valid" or "conflict!") and a win banner when `complete && valid`.
- [ ] **Step 4:** `src/routes/play/grecolatin/+page.svelte` — onMount: fetch the bundle (optional), create the worker transport + puzzle service, request `'grecolatin'` of a difficulty (default 'easy', seed prefixed 'grecolatin'), deserialize the instance via `getModule('grecolatin').deserializeInstance(res.instance)`, `store.load(inst.n, inst.givens)`. Render `GrecoBoard` wired to the store. Difficulty buttons regenerate. Record a solve to storage (`recordSolve('grecolatin', difficulty, elapsedMs)`) when `complete && valid`. Header with timer + back link. Dispose transport on destroy.
- [ ] **Step 5:** Picker `src/routes/+page.svelte`: add `<li><a href="/play/grecolatin">Greco-Latin</a></li>`.
- [ ] **Step 6:** Verify `bun run pregen && bun run build` (succeeds; pregen emits grecolatin), `bun run test`, check:engine 0, lint 0. Validate Svelte files via MCP. Commit `feat(app): Greco-Latin construction play UI`.

---

## Task 5: e2e smoke + final verification

**Files:** modify `e2e/smoke.spec.ts`

- [ ] **Step 1:** Add:
```ts
test('grecolatin play page renders a board', async ({ page }) => {
  await page.goto('/play/grecolatin');
  await expect(page.locator('.cell').first()).toBeVisible({ timeout: 30000 });
  // default order 5 → 25 cells
  await expect(page.locator('.cell')).toHaveCount(25);
});
```
(If the board uses a different cell class, match the GrecoBoard's actual cell class — keep `.cell` on each board cell for consistency.)
- [ ] **Step 2:** `bun run test:e2e` — all four puzzles' smokes pass.
- [ ] **Step 3:** Commit `test(app): Greco-Latin smoke test`.

---

## Done criteria
- `bun run test` green; `bun run build` ok; `bun run test:e2e` (4 puzzles) passes; check:engine + lint clean.
- Greco-Latin generates a valid square (orders 3,4,5,7,8,9; never 6), reveals givens by difficulty, validates the player's construction (both projections Latin + distinct pairs), and is playable via a dedicated board. All four puzzle types now ship.

## Self-review notes
- Construction-mode (no uniqueness) per spec/council; n=6 excluded (Euler). Odd orders use the direct cyclic construction; even orders (4,8) use backtracking search (GL squares exist for both).
- Greco-Latin intentionally bypasses the digit-based `PlayableGame` (pairs ≠ digits) with a dedicated route/board — the engine still registers in `MODULES` so the worker/pregen handle it through the seam.
- `validate` scores validity+completion (not uniqueness); difficulty = fraction of revealed givens (exact, so achievedDifficulty == requested).
