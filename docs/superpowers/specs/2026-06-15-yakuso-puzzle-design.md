# YAKUSO — puzzle design

**Date:** 2026-06-15
**Status:** Ratified by model-diverse council (Opus 4.8 / Sonnet 4.6 / Haiku 4.5), round 2 → unanimous APPROVE-WITH-CHANGES. All change items folded into this spec.
**Author:** brainstorming session
**Origin:** User request "add this game" + photo of *YAKUSO, Niveau 1* (a logic puzzle by Bertrand Lestre).

## 1. Summary

Add **YAKUSO** as the 5th puzzle type in `multilogic`, a unique-solution
deduction puzzle. It plugs into the existing engine/play/UI/registry layers
exactly like `kakuro`, with no new cross-cutting infrastructure.

## 2. Rules

- The board is **`R` interior rows × `C` columns**, with **`C = R + 1`**.
  - easy `3×4`, medium `4×5`, hard `5×6`, expert `6×7`.
- The `R` interior rows are assigned a **permutation of the digits `1..R`** —
  each row "owns" exactly one distinct digit `d`.
- A row that owns digit `d` contains the value `d` exactly **`d` times**; its
  other `C − d` cells are `0`. (`d ≤ C` always holds since `C = R+1 > R`.)
- A **totals row** beneath the grid gives each column's sum. The totals row is
  **always fully shown** to the player (every column total is a permanent clue).
- **Difficulty knob:** a number of **seeded interior cells** are revealed as
  fixed clues. *More seeds = easier* (expert reveals few). A seeded cell may
  legitimately be `0` (a forced-empty hint).
- The solution is **unique**.

### Worked example (from the photo, `R=3, C=4`)

```
2 0 2 0     ← row owns digit 2  (two 2s)
0 1 0 0     ← row owns digit 1  (one 1)
3 0 3 3     ← row owns digit 3  (three 3s)
─────────
5 1 5 3     ← totals (column sums), always shown
```

## 3. Interaction model

- A YAKUSO interior cell is either **empty (`0`)** or holds a **digit `1..R`**.
- The player selects a cell and enters a digit `1..R` via the existing
  `NumberPad` / keyboard; **erase clears the cell back to `0`**. There is **no
  `0` button** — empty *is* `0`. (Verified: `NumberPad.svelte` renders
  `1..maxDigit`; the play-route keyboard handler accepts `1..maxDigit` plus
  `Backspace`/`Delete` → `erase()`; `UndoableGame.erase()` sets the cell to `0`.)
- `maxDigit = R` (read by deserializing the instance, mirroring tectonic's
  region-size approach in `src/lib/play/registry.ts`).
- The **totals row is read-only by construction**: it is *not* part of the
  interactive cell array (see §4), so input/erase/note/hint can never target it.
  The grid renders it from `instance.totals`.
- Win = every interior cell decided **and** all constraints satisfied (each row
  has exactly `d` copies of its owned digit, the rows use a permutation of
  `1..R`, and every column sum equals its displayed total).

## 4. Data model (`src/engine/puzzles/yakuso/types.ts`)

```ts
export interface YakusoInstance {
  rows: number;                 // R
  cols: number;                 // C = R + 1
  totals: number[];             // length C, column sums (always shown)
  clues: (number | null)[];     // length R*C; null = unseeded, else seeded value 0..R
}
export type YakusoSolution = number[];     // length R*C, each cell 0 or its row's digit
export interface YakusoState { cells: number[] }   // length R*C, 0 = empty
export interface YakusoMove { index: number; value: number }
```

- **No `-1` sentinel.** "Unseeded" is `null` in `clues`; "empty" is `0` in
  play `cells`. `isGiven(i) = clues[i] !== null` for interior cells.
- The totals row is *not* part of `clues`/`cells`; it lives in `totals` and is
  rendered as a separate, always-read-only strip. (In the flat play board the
  UI presents `(R+1)×C`, but only the `R*C` interior cells are stateful; the
  bottom strip renders `totals` directly.)
- `serializeInstance` = `JSON.stringify` of `{rows, cols, totals, clues}`;
  `deserializeInstance` parses it. Solution serialized as a JSON number array.
  (Mirrors kakuro `rules.ts`.)

## 5. Solver & effort — ONE shared module

> Council requirement M1: solver (uniqueness) and rater (difficulty) **must
> share a single predicate** to prevent drift, and difficulty **must** be an
> effort metric compatible with `bandFromEffort` + the worker's request-vs-
> achieved fallback — not clue-density.

`measureEffort` (`src/engine/core/effort.ts`) treats `0` as *unfilled*, but in
YAKUSO `0` is the majority *solution* value, so the raw interior grid cannot be
fed to `measureEffort` directly. Instead YAKUSO provides a **single backtracking
solver** that serves both purposes:

```ts
// src/engine/puzzles/yakuso/solver.ts
interface YakusoSolveResult { count: number; solution: YakusoSolution | null; effort: number }
function solve(inst: YakusoInstance, opts: { limit: number }): YakusoSolveResult;
```

- **Search structure.** Backtracking over the interior grid using a shared
  `candidates(partial, i)` predicate. A cell's domain is `{0}` ∪ `{the digit its
  row owns}`; the owned digit is read from the partial grid (any real digit
  already placed in row `r` fixes row `r`'s digit) or, if undetermined, ranges
  over digits not yet owned by another row. The predicate enforces, against the
  partial grid: per-row digit-count (`≤ d` placed, exactly `d` at completion),
  the `1..R` permutation (no two rows own the same digit), and per-column
  partial sums (`≤ total`, with remaining-rows reachability), plus all `clues`.
- **`count`/`solution`** drive `solveComplete(inst, limit=2)` for uniqueness
  (early-exit at `count === 2`). Subset-sum collisions of `{1..R}` (e.g.
  `1+4 = 2+3`) are handled *by construction*: uniqueness is verified by this
  exhaustive bounded search on the actual instance, never inferred from sums.
- **`effort`** = number of guess-branches tried (including backtracked ones),
  exactly the `measureEffort` semantics, but counted inside this YAKUSO search
  so the `0`-is-empty mismatch is avoided. `rate()` =
  `bandFromEffort(solve(inst, {limit:1}).effort, YAKUSO_T1, YAKUSO_T2)`.
- **Thresholds `YAKUSO_T1/T2`** are calibrated from a generated distribution
  (see §7), mirroring kakuro's calibrated `KAKURO_T1/T2` comment block.
- Grids are tiny (`≤ 6×7`); the bounded search with column-sum pruning is fast.
  A budget guard (see §6) caps work during generation.

## 6. Generator (`src/engine/puzzles/yakuso/generator.ts`)

> Council requirements M2 / uniqueness oracle: pre-dig uniqueness assertion,
> oracle **inside** the dig loop, resample-on-stuck, concrete attempt cap.

`generateForDifficulty(prng, difficulty)`:

1. Pick `R, C` for the difficulty (`3/4, 4/5, 5/6, 6/7`).
2. Build a **known-valid solution**: random permutation assigning digits `1..R`
   to rows; for each row owning `d`, place `d` copies in a random `d`-subset of
   the `C` columns. Compute `totals` = column sums.
3. **Pre-dig check:** start from the fully-seeded instance (`clues` = every
   interior cell). Assert `solveComplete(full, 2).count === 1`. (Always true by
   construction, but asserted as the dig invariant's base case.)
4. **Dig loop:** in random order, try to set a `clue` back to `null`; keep the
   removal **only if `solveComplete(inst, 2).count === 1`**. The uniqueness
   oracle runs **at every removal**, not post-hoc. Continue until the seed count
   reaches the difficulty's target band or no further removal preserves
   uniqueness.
5. **Resample-on-stuck:** if the minimum-unique seed count for this solution
   exceeds the target band (some solutions can't be dug as sparse as expert
   wants), discard and resample from step 2.
6. **Attempt cap:** bounded by a concrete constant (`MAX_ATTEMPTS`, like
   kakuro's loop); on exhaustion return the best instance found with its honest
   `achievedDifficulty = rate(inst)`.
7. Return `{ instance, solution, difficulty: rate(instance) }`. The final
   instance is always verified unique.

The module `index.ts` wraps this with the **same request-vs-achieved RANK
fallback loop as kakuro** (`src/engine/puzzles/kakuro/index.ts`), so a
mismatched achieved difficulty is reported honestly rather than retried forever.
**Expert may be comparatively rare** (as kakuro expert is) — accepted, not faked.

## 7. Rating calibration & difficulty distribution

- `YAKUSO_T1/T2` are set from a sampled distribution of generated puzzles, and
  guarded by adding `'yakuso'` to `tests/engine/difficulty-distribution.test.ts`.
- If, after calibration, `hard`/`expert` prove unreachable for the smallest
  sizes, that is documented (the RANK fallback returns the closest achievable
  band honestly). No difficulty is faked by clue-count alone.

## 8. Play layer (`src/lib/play/yakuso-game.ts`)

`class YakusoGame extends UndoableGame` (`src/lib/play/base-game.ts`):

- Constructed from the deserialized instance + solution.
- The cell/notes array is **interior-only** (`R*C`); the totals strip is not a
  cell, so it is inherently non-interactive (no `isGiven` guard needed for it).
- `isGiven(i)` → `true` for seeded interior cells (`clues[i] !== null`).
- `allows(i, v)` → `v === 0 || (v >= 1 && v <= R)`.
- `conflicts()` → derived from the rules (a row holding `> d` copies of a digit /
  mixed digits; a column partial sum exceeding its total). Rule-based, not
  solution-based, for fair play.
- `isSolved()` → all interior cells filled **and** all constraints satisfied.

## 9. UI (`src/lib/components/YakusoGrid.svelte`)

- Renders `R+1` rows × `C` columns. Interior cells editable (unless given);
  the bottom totals strip is styled read-only (mirrors `KakuroGrid` clue cells).
- Standard props (`{ game, selected, tick, conflicts, onselect }`) so it works
  with the **generic dynamic route** — no bespoke route.
- Reuses `NumberPad` (digits `1..R`), `Toolbar`, `TimerView`.

## 10. Hint (`src/engine/puzzles/yakuso/hint.ts`)

> Council requirement M4: totals-row skip lives in `getHint`, not `isGiven`,
> because `GameStore.hint()` delegates entirely to the engine's `getHint`.

`getHint(instance, state)` returns one forced **interior** cell (a cell whose
value is uniquely determined by the shared solver's propagation). Because the
cell space is interior-only, a hint can never be a totals position. Returns
`null` if nothing is currently forced.

## 11. Touchpoints checklist

**Compile-forced** (build fails until done):
- [ ] `src/engine/core/types.ts` — add `'yakuso'` to the `PuzzleType` union.
- [ ] `src/engine/puzzles/registry.ts` — add `yakuso` to `MODULES`
      (`Record<PuzzleType, …>` makes this mandatory).
- [ ] `src/lib/i18n/messages.ts` — add `puzzle.yakuso` to **both** `en` and
      `fr` (the `fr: typeof en` constraint forces both).

**Silent (runtime/coverage) — must not be missed:**
- [ ] `src/lib/play/registry.ts` — add `PLAY_UI['yakuso']` (**linchpin**: it is
      `Partial<…>`, so omission is not a compile error but yields a blank route).
      Entry: `{ Grid: YakusoGrid, makeGame, hintProvider: makeHintProvider('yakuso'), maxDigit: deserialize→rows }`.
- [ ] `src/routes/+page.svelte` — add the `/play/yakuso` homepage link.
- [ ] `src/routes/daily/+page.svelte` — add `'yakuso'` to the `keys` array.
- [ ] New engine module files: `types.ts`, `rules.ts`, `solver.ts`,
      `generator.ts`, `rater.ts`, `hint.ts`, `index.ts`.
- [ ] New `src/lib/play/yakuso-game.ts` and `src/lib/components/YakusoGrid.svelte`.

**Auto-handled (no change needed), verified:**
- `scripts/pregen.ts` iterates `Object.entries(MODULES)` → picks up yakuso.
- `src/worker/{generate.worker,protocol}.ts`, `src/lib/puzzle-service.ts`,
  `src/lib/share.ts`, `src/lib/storage.ts`, CI/Dockerfile (`pregen && build`).
- Generic dynamic routes `src/routes/play/[type]/+page.svelte` and
  `daily/[type]/+page.svelte` already exist and dispatch via `PLAY_UI`; with the
  `PLAY_UI['yakuso']` entry, **no per-type route files are created**. (Grecolatin
  has bespoke routes only because it lacks a `PLAY_UI` entry.)

## 12. Testing

- `tests/engine/puzzles/yakuso/`:
  - `rules.test.ts` — row digit-count invariant; column-sum invariant;
    serialize/deserialize round-trip; column total of `0` handled.
  - `solver.test.ts` — known instances solve to `count === 1`; over-determined
    → `count === 0`; subset-sum-collision instance still resolves uniquely;
    shared `effort` count is deterministic.
  - `generator.test.ts` — output always unique; deterministic per seed; seed
    count lands in the difficulty's band; resample path covered.
  - `rater.test.ts` — easy ≤ medium ≤ hard ≤ expert ordering on fixtures.
  - `hint.test.ts` — returns a forced interior cell when one exists; never a
    totals-row index; `null` when nothing forced.
  - `module.test.ts` — `type==='yakuso'`, `kind==='deduction'`;
    `validateMove` rejects totals-row indices and out-of-range values.
- `tests/lib/yakuso-game.test.ts` — `isGiven` true for totals + seeded;
  input/erase blocked on totals; `allows` rejects `v > R`; `conflicts` flags
  count/sum violations; `isSolved` true iff complete + valid; undo/redo.
- Update `tests/engine/difficulty-distribution.test.ts` (add `'yakuso'`),
  `tests/scripts/pregen.test.ts` (assert bundle includes yakuso + solves
  uniquely), `tests/engine/puzzles/registry.test.ts` (assert `MODULES.yakuso`).

## 13. Staging note

Adding `'yakuso'` to `PuzzleType` + `MODULES` makes `pregen` (run in CI before
build) attempt yakuso generation. To keep CI green, the engine module's
`generate`/`solveComplete` must be functional in the **same commit** that widens
the union — i.e. land the engine module before (or with) the registry wiring.

## 14. Out of scope / accepted trade-offs

- No technique-named hint ladder (unlike sudoku); hints reveal one forced cell.
- Expert rarity at small sizes is accepted and reported honestly.
- Precompute-all-solutions was rejected as infeasible at `R=6` (~10¹²);
  robustness comes from "valid solution + uniqueness oracle at every dig."
