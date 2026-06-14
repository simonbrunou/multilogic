# Engine Foundation + Sudoku Solver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Multilogic project and build the pure-TS engine foundation — a seedable PRNG, core types, a generic Dancing Links (DLX) exact-cover solver, and a Sudoku module that can completely solve a grid and prove solution uniqueness.

**Architecture:** A framework-agnostic engine under `src/engine/` with zero browser/Worker/Svelte dependencies, so the identical code runs in the browser Worker, a Bun build script, and Vitest. This plan delivers `core/` (prng, dlx, uniqueness, types) plus `puzzles/sudoku/` rules + DLX-backed solver. No UI, no generation-by-digging yet — just "given a Sudoku, solve it / count its solutions."

**Tech Stack:** SvelteKit (static adapter), TypeScript, Bun, Vite, Vitest, fast-check (property testing).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/core/prng.ts` | Seedable deterministic PRNG (`xmur3` seed → `sfc32` stream) + helpers |
| `src/engine/core/types.ts` | Shared engine types: `Difficulty`, `GenArgs`, `GenResult`, `PuzzleModule` seam |
| `src/engine/core/dlx.ts` | Generic exact-cover solver (Dancing Links / Algorithm X) with solution cap |
| `src/engine/puzzles/sudoku/types.ts` | Sudoku instance/cell types |
| `src/engine/puzzles/sudoku/rules.ts` | Grid ↔ exact-cover matrix mapping; constants |
| `src/engine/puzzles/sudoku/solver.ts` | `solveComplete` (uniqueness oracle, stop-at-2) via DLX |
| `tsconfig.engine.json` | Restricted tsconfig enforcing engine purity (no DOM lib) |
| `eslint.config.js` | `no-restricted-globals`/`-imports` rule scoped to `src/engine/` |
| `tests/engine/**` | Vitest unit + fast-check property tests mirroring the above |

**Determinism contract (load-bearing):** every function in `src/engine/` that needs randomness takes a `PRNG` instance as a parameter — never calls `Math.random`/`crypto`. Same seed ⇒ identical output, verified by a property test.

---

## Task 0: Project scaffold

**Files:**
- Create: project skeleton via SvelteKit CLI, `tsconfig.engine.json`, `eslint.config.js`, `vitest.config.ts`
- Modify: `svelte.config.js`, `package.json`

- [ ] **Step 1: Scaffold the SvelteKit app with Bun**

Run (in the repo root — it already contains `LICENSE`, `README.md`, `docs/`):
```bash
bunx sv create . --template minimal --types ts --no-add-ons --install bun
```
If the CLI refuses to write into a non-empty directory, scaffold in a temp dir and move files in:
```bash
bunx sv create /tmp/ml-scaffold --template minimal --types ts --no-add-ons --install bun
cp -rn /tmp/ml-scaffold/. .
rm -rf /tmp/ml-scaffold
bun install
```
Expected: `src/`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `package.json` now exist.

- [ ] **Step 2: Add dependencies (static adapter, vitest, fast-check)**

Run:
```bash
bun add -D @sveltejs/adapter-static vitest fast-check @vitest/coverage-v8
```
Expected: all four appear under `devDependencies` in `package.json`.

- [ ] **Step 3: Switch to the static adapter**

Edit `svelte.config.js` so the adapter import and usage are:
```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' })
  }
};
export default config;
```

- [ ] **Step 4: Create `vitest.config.ts`**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
});
```

- [ ] **Step 5: Create the engine-purity tsconfig**

Create `tsconfig.engine.json`:
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2022"],
    "types": []
  },
  "include": ["src/engine/**/*.ts"]
}
```
(Note the absence of `"DOM"` in `lib` — referencing `window`/`document` in the engine becomes a type error.)

- [ ] **Step 6: Add an ESLint engine-purity rule**

Create `eslint.config.js`:
```js
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/engine/**/*.ts'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      'no-restricted-globals': ['error',
        { name: 'self', message: 'engine must be runtime-agnostic' },
        { name: 'window', message: 'engine must be runtime-agnostic' },
        { name: 'document', message: 'engine must be runtime-agnostic' },
        { name: 'crypto', message: 'use the injected PRNG' },
        { name: 'performance', message: 'engine must be runtime-agnostic' }
      ],
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'use the injected PRNG' }
      ]
    }
  }
];
```
Run:
```bash
bun add -D eslint @eslint/js
```

- [ ] **Step 7: Add scripts to `package.json`**

Ensure the `"scripts"` block contains:
```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "check:engine": "tsc -p tsconfig.engine.json",
    "lint": "eslint ."
  }
}
```

- [ ] **Step 8: Verify the toolchain runs**

Run:
```bash
bun run test
```
Expected: Vitest runs and reports "No test files found" (exit 0) — toolchain works, no tests yet.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold SvelteKit + static adapter + vitest + engine-purity config"
```

---

## Task 1: Seedable PRNG

**Files:**
- Create: `src/engine/core/prng.ts`
- Test: `tests/engine/core/prng.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/core/prng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createPrng } from '../../../src/engine/core/prng';

describe('createPrng', () => {
  it('is deterministic: same seed yields the same sequence', () => {
    const a = createPrng('seed-A');
    const b = createPrng('seed-A');
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds yield different sequences', () => {
    const a = createPrng('seed-A');
    const b = createPrng('seed-B');
    expect(a.next()).not.toEqual(b.next());
  });

  it('next() returns values in [0, 1)', () => {
    const r = createPrng('range');
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) returns an integer in [0, n)', () => {
    const r = createPrng('int');
    for (let i = 0; i < 1000; i++) {
      const v = r.int(7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it('shuffle is a permutation and is deterministic for a seed', () => {
    const base = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = createPrng('shuf').shuffle([...base]);
    const s2 = createPrng('shuf').shuffle([...base]);
    expect(s1).toEqual(s2);
    expect([...s1].sort((x, y) => x - y)).toEqual(base);
  });

  it('property: numeric seeds are also deterministic', () => {
    fc.assert(fc.property(fc.integer(), (seed) => {
      const x = createPrng(seed).next();
      const y = createPrng(seed).next();
      return x === y;
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- prng`
Expected: FAIL — cannot resolve `src/engine/core/prng`.

- [ ] **Step 3: Implement the PRNG**

Create `src/engine/core/prng.ts`:
```ts
/** Seedable, runtime-agnostic PRNG. Inject this everywhere the engine needs randomness. */
export interface PRNG {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** Fisher–Yates shuffle in place; returns the same array. */
  shuffle<T>(arr: T[]): T[];
  /** Random element of a non-empty array. */
  pick<T>(arr: T[]): T;
}

/** xmur3 string hash → 32-bit seed generator. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** sfc32: fast 32-bit PRNG. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Create a PRNG from a string or numeric seed. */
export function createPrng(seed: string | number): PRNG {
  const seedStr = typeof seed === 'number' ? `n:${seed}` : seed;
  const h = xmur3(seedStr);
  const next = sfc32(h(), h(), h(), h());
  return {
    next,
    int(n: number) {
      return Math.floor(next() * n);
    },
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(next() * arr.length)];
    }
  };
}

/** Deterministic seed derivation, used by daily puzzles and tests. */
export function deriveSeed(...parts: (string | number)[]): string {
  return parts.map(String).join('|');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- prng`
Expected: PASS (all cases).

- [ ] **Step 5: Verify engine purity still type-checks**

Run: `bun run check:engine`
Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/core/prng.ts tests/engine/core/prng.test.ts
git commit -m "feat(engine): seedable deterministic PRNG"
```

---

## Task 2: Core types

**Files:**
- Create: `src/engine/core/types.ts`
- Test: `tests/engine/core/types.test.ts`

- [ ] **Step 1: Write a failing compile-time/usage test**

Create `tests/engine/core/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DIFFICULTIES, isDifficulty } from '../../../src/engine/core/types';

describe('core types', () => {
  it('exposes the difficulty band order', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard', 'expert']);
  });

  it('isDifficulty narrows valid strings', () => {
    expect(isDifficulty('hard')).toBe(true);
    expect(isDifficulty('impossible')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- types`
Expected: FAIL — cannot resolve `src/engine/core/types`.

- [ ] **Step 3: Implement the types**

Create `src/engine/core/types.ts`:
```ts
import type { PRNG } from './prng';

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export function isDifficulty(s: string): s is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(s);
}

export type PuzzleType = 'sudoku' | 'tectonic' | 'kakuro' | 'grecolatin';

/** Engine-internal generate() args. `signal` is created worker-side (never serialised). */
export interface GenArgs {
  difficulty: Difficulty;
  prng: PRNG;
  signal: AbortSignal;
}

/** Drives the worker fallback chain: compare requested vs achieved difficulty, know the source. */
export interface GenResult<Instance, Solution> {
  instance: Instance;
  solution: Solution | null; // null for construction puzzles
  achievedDifficulty: Difficulty;
  source: 'live' | 'baked';
}

/** Result of a complete-solve / uniqueness check. */
export interface SolveResult<Solution> {
  /** Number of solutions found, capped at the requested limit. */
  count: number;
  /** The first solution found, if any. */
  solution: Solution | null;
}

export interface PuzzleBase<Instance, State, Move> {
  type: PuzzleType;
  generate(args: GenArgs): Promise<GenResult<Instance, unknown>>;
  validateMove(instance: Instance, state: State, move: Move): MoveResult;
  getHint?(instance: Instance, state: State): Hint | null;
  render(instance: Instance, state: State): RenderModel;
}

export interface DeductionPuzzle<Instance, State, Move, Solution>
  extends PuzzleBase<Instance, State, Move> {
  kind: 'deduction';
  solveComplete(instance: Instance, limit?: number): SolveResult<Solution>;
  rate(instance: Instance): Difficulty;
}

export interface ConstructionPuzzle<Instance, State, Move>
  extends PuzzleBase<Instance, State, Move> {
  kind: 'construction';
  validate(instance: Instance, state: State): ConstructionResult;
}

export type PuzzleModule =
  | DeductionPuzzle<any, any, any, any>
  | ConstructionPuzzle<any, any, any>;

// Named placeholder types — shaped per puzzle as each arm is implemented.
export interface MoveResult { ok: boolean; reason?: string }
export interface Hint { cells: number[]; text: string }
export interface RenderModel { kind: string; [k: string]: unknown }
export interface ConstructionResult { complete: boolean; valid: boolean; score: number }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- types`
Expected: PASS.

- [ ] **Step 5: Verify engine purity type-checks**

Run: `bun run check:engine`
Expected: exit 0. (`AbortSignal` is part of ES2022 lib — no DOM needed.)

- [ ] **Step 6: Commit**

```bash
git add src/engine/core/types.ts tests/engine/core/types.test.ts
git commit -m "feat(engine): core types (Difficulty, GenResult, PuzzleModule seam)"
```

---

## Task 3: DLX exact-cover solver

**Files:**
- Create: `src/engine/core/dlx.ts`
- Test: `tests/engine/core/dlx.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/core/dlx.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Dlx } from '../../../src/engine/core/dlx';

describe('Dlx exact cover', () => {
  // Classic Knuth example: columns {1..7}, find subset of rows covering each column once.
  // Rows (1-indexed columns): A={1,4,7} B={1,4} C={4,5,7} D={3,5,6} E={2,3,6,7} F={2,7}
  // Unique exact cover = {B, D, F}.
  function buildKnuth(): Dlx {
    const dlx = new Dlx(7);
    dlx.addRow(0, [0, 3, 6]); // A
    dlx.addRow(1, [0, 3]);    // B
    dlx.addRow(2, [3, 4, 6]); // C
    dlx.addRow(3, [2, 4, 5]); // D
    dlx.addRow(4, [1, 2, 5, 6]); // E
    dlx.addRow(5, [1, 6]);    // F
    return dlx;
  }

  it('finds the unique exact cover', () => {
    const sols = buildKnuth().solve();
    expect(sols.length).toBe(1);
    expect([...sols[0]].sort((a, b) => a - b)).toEqual([1, 3, 5]); // B, D, F
  });

  it('respects the solution limit (stop-at-N)', () => {
    const sols = buildKnuth().solve(1);
    expect(sols.length).toBe(1);
  });

  it('returns no solutions when none exist', () => {
    const dlx = new Dlx(3);
    dlx.addRow(0, [0]); // can never cover columns 1 and 2
    expect(dlx.solve().length).toBe(0);
  });

  it('counts multiple solutions up to the limit', () => {
    // Two columns, two single-column rows each → 1 exact cover; build an ambiguous one instead:
    const dlx = new Dlx(2);
    dlx.addRow(0, [0, 1]); // covers both
    dlx.addRow(1, [0, 1]); // also covers both → two distinct single-row covers
    const sols = dlx.solve(5);
    expect(sols.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- dlx`
Expected: FAIL — cannot resolve `src/engine/core/dlx`.

- [ ] **Step 3: Implement DLX (Algorithm X with dancing links)**

Create `src/engine/core/dlx.ts`:
```ts
/**
 * Generic exact-cover solver via Knuth's Dancing Links (Algorithm X).
 * Columns are 0-indexed. addRow(rowId, columns) registers a row covering those columns.
 * solve(limit) returns up to `limit` solutions, each an array of the rowIds chosen.
 */

interface Node {
  L: Node; R: Node; U: Node; D: Node;
  C: Column;
  rowId: number;
}
interface Column extends Node {
  size: number;
  name: number;
}

export class Dlx {
  private readonly header: Column;
  private readonly columns: Column[];

  constructor(numColumns: number) {
    const header = this.makeColumn(-1);
    header.L = header; header.R = header;
    this.header = header;
    this.columns = [];
    let prev: Column = header;
    for (let i = 0; i < numColumns; i++) {
      const col = this.makeColumn(i);
      col.L = prev; col.R = header;
      prev.R = col; header.L = col;
      this.columns.push(col);
      prev = col;
    }
  }

  private makeColumn(name: number): Column {
    const col = { size: 0, name } as Column;
    col.U = col; col.D = col; col.L = col; col.R = col;
    col.C = col; col.rowId = -1;
    return col;
  }

  addRow(rowId: number, cols: number[]): void {
    let first: Node | null = null;
    for (const c of cols) {
      const col = this.columns[c];
      const node = { rowId } as Node;
      node.C = col;
      // link vertically above the column header (i.e. at the bottom of the column)
      node.D = col; node.U = col.U;
      col.U.D = node; col.U = node;
      col.size++;
      // link horizontally within the row
      if (first === null) {
        node.L = node; node.R = node;
        first = node;
      } else {
        node.L = first.L; node.R = first;
        first.L.R = node; first.L = node;
      }
    }
  }

  private cover(col: Column): void {
    col.R.L = col.L; col.L.R = col.R;
    for (let i = col.D; i !== col; i = i.D) {
      for (let j = i.R; j !== i; j = j.R) {
        j.D.U = j.U; j.U.D = j.D;
        j.C.size--;
      }
    }
  }

  private uncover(col: Column): void {
    for (let i = col.U; i !== col; i = i.U) {
      for (let j = i.L; j !== i; j = j.L) {
        j.C.size++;
        j.D.U = j; j.U.D = j;
      }
    }
    col.R.L = col; col.L.R = col;
  }

  private chooseColumn(): Column | null {
    let best: Column | null = null;
    let min = Infinity;
    for (let c = this.header.R; c !== this.header; c = c.R) {
      const col = c as Column;
      if (col.size < min) { min = col.size; best = col; if (min === 0) break; }
    }
    return best;
  }

  solve(limit = Infinity): number[][] {
    const solutions: number[][] = [];
    const stack: number[] = [];

    const search = (): void => {
      if (solutions.length >= limit) return;
      if (this.header.R === this.header) {
        solutions.push([...stack]);
        return;
      }
      const col = this.chooseColumn();
      if (col === null || col.size === 0) return; // dead end
      this.cover(col);
      for (let r = col.D; r !== col && solutions.length < limit; r = r.D) {
        stack.push(r.rowId);
        for (let j = r.R; j !== r; j = j.R) this.cover(j.C);
        search();
        for (let j = r.L; j !== r; j = j.L) this.uncover(j.C);
        stack.pop();
      }
      this.uncover(col);
    };

    search();
    return solutions;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- dlx`
Expected: PASS (all four cases).

- [ ] **Step 5: Verify engine purity type-checks**

Run: `bun run check:engine`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/engine/core/dlx.ts tests/engine/core/dlx.test.ts
git commit -m "feat(engine): generic Dancing Links exact-cover solver"
```

---

## Task 4: Sudoku types + exact-cover mapping

**Files:**
- Create: `src/engine/puzzles/sudoku/types.ts`, `src/engine/puzzles/sudoku/rules.ts`
- Test: `tests/engine/puzzles/sudoku/rules.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/puzzles/sudoku/rules.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { gridFromString, gridToString, buildDlx } from '../../../../src/engine/puzzles/sudoku/rules';

const SOLVED =
  '534678912' + '672195348' + '198342567' +
  '859761423' + '426853791' + '713924856' +
  '961537284' + '287419635' + '345286179';

describe('sudoku rules', () => {
  it('round-trips a grid string', () => {
    const g = gridFromString(SOLVED);
    expect(g.length).toBe(81);
    expect(gridToString(g)).toBe(SOLVED);
  });

  it('treats 0 and . as empty', () => {
    const g = gridFromString('.'.repeat(81));
    expect(g.every((v) => v === 0)).toBe(true);
  });

  it('builds a DLX with 324 columns and one row per candidate', () => {
    const empty = gridFromString('0'.repeat(81));
    const dlx = buildDlx(empty);
    // a fully empty grid has 81 cells * 9 candidates = 729 rows; solving yields a full grid
    const sols = dlx.solve(1);
    expect(sols.length).toBe(1);
    expect(sols[0].length).toBe(81); // 81 placements chosen
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- sudoku/rules`
Expected: FAIL — cannot resolve the rules module.

- [ ] **Step 3: Implement Sudoku types**

Create `src/engine/puzzles/sudoku/types.ts`:
```ts
/** A Sudoku grid is 81 cells in row-major order; 0 = empty, 1..9 = filled. */
export type SudokuGrid = number[];

export interface SudokuInstance {
  /** The puzzle as given (with empties). */
  givens: SudokuGrid;
}

export type SudokuSolution = SudokuGrid;

export interface SudokuState {
  /** Player-entered values, row-major; 0 = empty. */
  cells: SudokuGrid;
}

export interface SudokuMove {
  index: number; // 0..80
  value: number; // 0 to clear, else 1..9
}
```

- [ ] **Step 4: Implement the rules / DLX mapping**

Create `src/engine/puzzles/sudoku/rules.ts`:
```ts
import { Dlx } from '../../core/dlx';
import type { SudokuGrid } from './types';

export const N = 9;
export const CELLS = 81;

export function gridFromString(s: string): SudokuGrid {
  const clean = s.trim();
  if (clean.length !== CELLS) throw new Error(`grid must be ${CELLS} chars, got ${clean.length}`);
  return [...clean].map((ch) => (ch === '.' || ch === '0' ? 0 : Number(ch)));
}

export function gridToString(g: SudokuGrid): string {
  return g.map((v) => (v === 0 ? '0' : String(v))).join('');
}

/**
 * Exact-cover column layout (324 columns):
 *   0..80    cell (r,c) is filled                     : index r*9+c
 *   81..161  row r contains digit d                   : 81 + r*9 + (d-1)
 *   162..242 col c contains digit d                   : 162 + c*9 + (d-1)
 *   243..323 box b contains digit d                   : 243 + b*9 + (d-1)
 * A candidate "place digit d at (r,c)" covers exactly those 4 columns.
 * rowId encodes the placement as (r*9+c)*9 + (d-1) so a solution maps back to a grid.
 */
export function candidateColumns(r: number, c: number, d: number): number[] {
  const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
  return [
    r * 9 + c,
    81 + r * 9 + (d - 1),
    162 + c * 9 + (d - 1),
    243 + box * 9 + (d - 1)
  ];
}

export function rowIdFor(r: number, c: number, d: number): number {
  return (r * 9 + c) * 9 + (d - 1);
}

export function decodeRowId(rowId: number): { r: number; c: number; d: number } {
  const d = (rowId % 9) + 1;
  const cell = Math.floor(rowId / 9);
  return { r: Math.floor(cell / 9), c: cell % 9, d };
}

/** Build a DLX for the given grid, restricting candidates to the givens where present. */
export function buildDlx(grid: SudokuGrid): Dlx {
  const dlx = new Dlx(324);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const given = grid[r * 9 + c];
      const digits = given === 0 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [given];
      for (const d of digits) {
        dlx.addRow(rowIdFor(r, c, d), candidateColumns(r, c, d));
      }
    }
  }
  return dlx;
}

/** Convert a DLX solution (list of rowIds) back into a solved grid. */
export function gridFromSolution(rowIds: number[]): SudokuGrid {
  const g = new Array(CELLS).fill(0);
  for (const id of rowIds) {
    const { r, c, d } = decodeRowId(id);
    g[r * 9 + c] = d;
  }
  return g;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- sudoku/rules`
Expected: PASS.

- [ ] **Step 6: Verify engine purity type-checks**

Run: `bun run check:engine`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/engine/puzzles/sudoku/types.ts src/engine/puzzles/sudoku/rules.ts tests/engine/puzzles/sudoku/rules.test.ts
git commit -m "feat(sudoku): grid types + exact-cover DLX mapping"
```

---

## Task 5: Sudoku complete solver + uniqueness oracle

**Files:**
- Create: `src/engine/puzzles/sudoku/solver.ts`
- Test: `tests/engine/puzzles/sudoku/solver.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/puzzles/sudoku/solver.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { solveComplete, solveOne } from '../../../../src/engine/puzzles/sudoku/solver';
import { gridFromString, gridToString } from '../../../../src/engine/puzzles/sudoku/rules';

const PUZZLE =
  '53..7....' + '6..195...' + '.98....6.' +
  '8...6...3' + '4..8.3..1' + '7...2...6' +
  '.6....28.' + '...419..5' + '....8..79';
const SOLUTION =
  '534678912' + '672195348' + '198342567' +
  '859761423' + '426853791' + '713924856' +
  '961537284' + '287419635' + '345286179';

describe('sudoku solver', () => {
  it('solves a valid puzzle to the known solution', () => {
    const inst = { givens: gridFromString(PUZZLE) };
    const sol = solveOne(inst);
    expect(sol).not.toBeNull();
    expect(gridToString(sol!)).toBe(SOLUTION);
  });

  it('reports exactly one solution for a unique puzzle (oracle)', () => {
    const inst = { givens: gridFromString(PUZZLE) };
    const res = solveComplete(inst, 2);
    expect(res.count).toBe(1);
  });

  it('detects multiple solutions for an under-constrained grid', () => {
    const inst = { givens: gridFromString('0'.repeat(81)) };
    const res = solveComplete(inst, 2);
    expect(res.count).toBe(2); // capped at the limit
  });

  it('property: solving the solution returns the solution unchanged', () => {
    const inst = { givens: gridFromString(SOLUTION) };
    const res = solveComplete(inst, 2);
    expect(res.count).toBe(1);
    expect(gridToString(res.solution!)).toBe(SOLUTION);
  });

  it('property: solver output is deterministic across runs', () => {
    fc.assert(fc.property(fc.constant(PUZZLE), (p) => {
      const a = solveOne({ givens: gridFromString(p) });
      const b = solveOne({ givens: gridFromString(p) });
      return gridToString(a!) === gridToString(b!);
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- sudoku/solver`
Expected: FAIL — cannot resolve the solver module.

- [ ] **Step 3: Implement the solver**

Create `src/engine/puzzles/sudoku/solver.ts`:
```ts
import { buildDlx, gridFromSolution } from './rules';
import type { SudokuInstance, SudokuSolution } from './types';
import type { SolveResult } from '../../core/types';

/**
 * Uniqueness oracle: solve with a hard cap on solutions found.
 * `limit = 2` is the canonical uniqueness check (count === 1 ⇒ unique).
 */
export function solveComplete(
  instance: SudokuInstance,
  limit = 2
): SolveResult<SudokuSolution> {
  const dlx = buildDlx(instance.givens);
  const sols = dlx.solve(limit);
  return {
    count: sols.length,
    solution: sols.length > 0 ? gridFromSolution(sols[0]) : null
  };
}

/** Convenience: return the first solution (or null). */
export function solveOne(instance: SudokuInstance): SudokuSolution | null {
  return solveComplete(instance, 1).solution;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- sudoku/solver`
Expected: PASS (all five cases).

- [ ] **Step 5: Run the full suite + engine checks**

Run:
```bash
bun run test
bun run check:engine
bun run lint
```
Expected: all green (lint may warn on non-engine files; engine files must be clean).

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/sudoku/solver.ts tests/engine/puzzles/sudoku/solver.test.ts
git commit -m "feat(sudoku): complete solver + stop-at-2 uniqueness oracle"
```

---

## Task 6: Deterministic full-grid generator (seed → solved grid)

This produces a *complete, valid, random* Sudoku solution from a seed — the starting point for Plan 2's clue-digging. It belongs here because it exercises the PRNG + DLX together and is fully testable now.

**Files:**
- Create: `src/engine/puzzles/sudoku/fullgrid.ts`
- Test: `tests/engine/puzzles/sudoku/fullgrid.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/puzzles/sudoku/fullgrid.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateFullGrid } from '../../../../src/engine/puzzles/sudoku/fullgrid';
import { solveComplete } from '../../../../src/engine/puzzles/sudoku/solver';
import { gridToString } from '../../../../src/engine/puzzles/sudoku/rules';
import { createPrng } from '../../../../src/engine/core/prng';

function isValidFull(g: number[]): boolean {
  if (g.some((v) => v < 1 || v > 9)) return false;
  const seen = (idxs: number[]) => {
    const s = new Set(idxs.map((i) => g[i]));
    return s.size === 9;
  };
  for (let i = 0; i < 9; i++) {
    if (!seen([...Array(9)].map((_, c) => i * 9 + c))) return false;       // row
    if (!seen([...Array(9)].map((_, r) => r * 9 + i))) return false;       // col
    const br = Math.floor(i / 3) * 3, bc = (i % 3) * 3;
    const box = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box.push((br + r) * 9 + (bc + c));
    if (!seen(box)) return false;                                          // box
  }
  return true;
}

describe('generateFullGrid', () => {
  it('produces a valid complete grid', () => {
    const g = generateFullGrid(createPrng('grid-1'));
    expect(isValidFull(g)).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const a = generateFullGrid(createPrng('same'));
    const b = generateFullGrid(createPrng('same'));
    expect(gridToString(a)).toBe(gridToString(b));
  });

  it('different seeds usually produce different grids', () => {
    const a = generateFullGrid(createPrng('one'));
    const b = generateFullGrid(createPrng('two'));
    expect(gridToString(a)).not.toBe(gridToString(b));
  });

  it('the generated grid is itself a uniquely-solvable complete board', () => {
    const g = generateFullGrid(createPrng('unique'));
    expect(solveComplete({ givens: g }, 2).count).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- fullgrid`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement the full-grid generator**

Create `src/engine/puzzles/sudoku/fullgrid.ts`:
```ts
import { Dlx } from '../../core/dlx';
import { candidateColumns, rowIdFor, gridFromSolution } from './rules';
import type { SudokuGrid } from './types';
import type { PRNG } from '../../core/prng';

/**
 * Generate a complete, valid Sudoku solution deterministically from a PRNG.
 * Strategy: build the full 729-candidate DLX but add each cell's 9 candidates in a
 * PRNG-shuffled digit order. DLX picks the first viable branch, so shuffling the
 * insertion order yields a random — yet seed-reproducible — solution.
 */
export function generateFullGrid(prng: PRNG): SudokuGrid {
  const dlx = new Dlx(324);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const digits = prng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const d of digits) {
        dlx.addRow(rowIdFor(r, c, d), candidateColumns(r, c, d));
      }
    }
  }
  const sols = dlx.solve(1);
  if (sols.length === 0) throw new Error('failed to generate a full grid');
  return gridFromSolution(sols[0]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- fullgrid`
Expected: PASS (all four cases).

> Note: this relies on DLX exploring a chosen column's rows top-to-bottom in insertion order. Task 3's `addRow` appends each node at the bottom of its column (`col.U` insertion), so the first-added candidate for a cell is tried first — shuffling insertion order therefore randomises the branch taken. If the "different seeds" test ever flakes, widen it to compare across 3 seeds.

- [ ] **Step 5: Full suite + engine checks**

Run:
```bash
bun run test
bun run check:engine
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/sudoku/fullgrid.ts tests/engine/puzzles/sudoku/fullgrid.test.ts
git commit -m "feat(sudoku): deterministic full-grid generator (seed -> solved board)"
```

---

## Done criteria for Plan 1

- `bun run test` is green; `bun run check:engine` exits 0; engine files pass `bun run lint`.
- You can: solve any Sudoku, prove uniqueness (stop-at-2), and generate a seed-reproducible complete grid — all in pure, runtime-agnostic TS.
- **Next:** Plan 2 (Sudoku Generation + Rating + Hints) digs clues out of the full grid using the uniqueness oracle, adds the per-type difficulty rater (technique solver) and `getHint`, and writes `scripts/pregen.ts`.

---

## Self-review notes

- **Spec coverage (Plan 1 slice):** PRNG + determinism contract (§3.1, §3.2) → Task 1; core types incl. `GenResult`/`PuzzleModule` seam (§3.2) → Task 2; DLX as opt-in exact-cover accelerator (§3.1) → Task 3; Sudoku rules/mapping → Task 4; two-solver model — the uniqueness *oracle* `solveComplete` stop-at-2 (§3.3) → Task 5 (the *rater* is deferred to Plan 2, per §3.3/§10). Engine purity enforcement (§3.1) → Task 0.
- **Type consistency:** `SolveResult<Solution>` defined in Task 2 and consumed in Task 5; `SudokuInstance.givens` defined in Task 4 and used in Tasks 5–6; `rowIdFor`/`decodeRowId`/`candidateColumns` defined in Task 4 and reused in Task 6.
- **Deferred to later plans (intentional):** `generate`/`rate`/`getHint`/`render`/`validateMove` (Plans 2–3), worker, UI, persistence, daily, share.
