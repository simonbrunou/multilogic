# Multilogic — Procedurally Generated Puzzles: Design Spec

**Date:** 2026-06-14
**Status:** Approved design, ready for implementation planning

## 1. Summary

Multilogic is a **client-side, static web app** for playing **procedurally generated grid-fill
logic puzzles** in the browser. No accounts, no backend — the entire app deploys as static
files. Puzzles are generated live in a Web Worker, with a small pre-generated bundle as a
fallback for instant first load and weak devices.

**Puzzle roster (built in this order):**

1. **Sudoku** — 9×9 Latin square + 3×3 boxes. The reference implementation that proves the
   whole vertical slice.
2. **Tectonic (Suguru)** — irregular regions of size *n* hold 1..*n*; no equal digit in any of
   the 8 neighbours (orthogonal + diagonal).
3. **Kakuro** — fill runs of cells so each run sums to its clue; no repeated digit within a run;
   black/clue cells with split down/right sums.
4. **Greco-Latin (construction mode)** — place (symbol, colour) pairs so both projections are
   Latin squares and all pairs are distinct. Scored on **validity & completion**, *not* a unique
   solution. Orders n ∈ {3, 4, 5, 7, 8, 9} (n = 6 excluded — no Greco-Latin square exists, per
   Euler/Tarry).

**Primary goal:** a great *play-in-the-browser* experience — puzzles that render cleanly, accept
input smoothly, validate instantly, and feel good to solve.

## 2. Goals & non-goals

**Goals**
- Interactive solving with a polished, responsive UI (desktop keyboard + mobile touch, equal weight).
- Procedural generation with a **guaranteed unique solution** for deduction puzzles (Sudoku,
  Tectonic, Kakuro).
- Per-type difficulty selection backed by real difficulty rating.
- Local persistence: save/resume, per-type stats, settings.
- A lightweight retention loop: date-seeded **daily puzzle** + **shareable result**.

**Non-goals (v1)**
- User accounts, server-side sync, cross-device persistence.
- Leaderboards, social graph, multiplayer.
- Streaks (deferred; localStorage-only, easy fast-follow).
- WASM solvers (TS-first; revisit only if a puzzle exceeds the latency budget — see §6).

## 3. Architecture

Three hard-separated layers:

```
[Svelte UI] ──postMessage──▶ [Web Worker] ──▶ [Puzzle engine: pure TS, no DOM]
     │                                              core/ + puzzles/
     └── localStorage (save/resume, stats, settings)
```

### 3.1 Layout

```
src/
  engine/                # PURE, runtime-agnostic TypeScript — runs in Worker, Node build, and tests
    core/
      prng.ts            # seedable PRNG (sfc32/xoshiro); determinism contract
      dlx.ts             # exact-cover (Dancing Links) — OPT-IN, Sudoku/Latin only
      backtracking.ts    # direct backtracker; shared CSP utilities EMERGE here when Tectonic needs them
      uniqueness.ts      # the ORACLE: complete solve, stop at 2 solutions
      difficulty.ts      # shared Difficulty band ENUM only (rating harness lives per-puzzle)
      types.ts           # PuzzleModule interface + per-type instance unions (Sudoku arm first)
    puzzles/
      sudoku/            # rules, generator, solver (DLX), rater, hints, render
      tectonic/          # (added in phase 2)
      kakuro/            # (added in phase 3)
      grecolatin/        # (added in phase 4) — construction mode, validate() instead of oracle
  worker/                # thin adapter: protocol, timeout/fallback, calls engine
  lib/                   # Svelte stores/runes, components
  routes/                # / (picker), /play/[type], /daily, /stats, /settings
scripts/
  pregen.ts              # build-time: runs the SAME engine over a fixed seed list → fallback bundle (CI artifact)
```

**Engine purity (hard requirement).** `src/engine/**` must use **no** browser/Worker/runtime
globals: no `self`, `postMessage`, `Math.random`, `crypto`, `performance.now`, no Svelte / `$app`
imports. The identical module runs in the Worker (runtime), `scripts/pregen.ts` (Node/Bun build),
and Vitest. Enforced by lint rule + a dedicated tsconfig.

**No barrel exports** from `engine/puzzles` — explicit imports only, so `dlx.ts` tree-shakes out
of bundles that don't use it (everything except Sudoku).

### 3.2 The PuzzleModule seam

Discriminated by `kind` so deduction-only methods are *structurally absent* from construction
puzzles (calling them is a compile error, not a runtime stub):

```ts
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';   // shared band enum

interface GenArgs { difficulty: Difficulty; prng: PRNG; signal: AbortSignal }

interface PuzzleBase<Instance, State, Move> {
  type: PuzzleType;
  generate(args: GenArgs): Promise<GenResult<Instance>>;
  validateMove(i: Instance, s: State, m: Move): MoveResult;
  getHint?(i: Instance, s: State): Hint | null;            // OPTIONAL — added per-puzzle
  render(i: Instance, s: State): RenderModel;              // a FUNCTION of state, not a value
}

interface DeductionPuzzle<I, S, M> extends PuzzleBase<I, S, M> {
  kind: 'deduction';
  solveComplete(i: I): SolveResult;   // uniqueness oracle, stop-at-2
  rate(i: I): Difficulty;             // per-type rater, reuses solver technique-log
}

interface ConstructionPuzzle<I, S, M> extends PuzzleBase<I, S, M> {
  kind: 'construction';
  validate(i: I, s: S): ConstructionResult;  // completion + validity score
}

type PuzzleModule = DeductionPuzzle<any, any, any> | ConstructionPuzzle<any, any, any>;
```

`Instance`, `RenderModel`, and constraint sets are **per-type discriminated unions**. Only the
**Sudoku arm is defined initially**; each later puzzle adds its arm. `generate` receives an
**already-seeded `PRNG` instance** (never a raw seed it derives internally) so build script,
worker, daily puzzle, and tests share one derivation path.

### 3.3 Two solvers, never conflated

- **Uniqueness oracle** (`solveComplete`): a *complete* solver that stops at the 2nd solution.
  This is the only thing that guarantees uniqueness during generation.
- **Difficulty rater** (`rate`): a *human-technique* solver per type, which logs which techniques
  it needed. The rater consumes the same solver instrumentation rather than being a second,
  divergent solver. Difficulty rating does **not** generalise as shared code — each module ships
  its own technique ladder; only the band *enum* and the rating *contract* are shared.

## 4. Generation strategy

One generator, **two entry points**:

- **Runtime:** the Worker calls `module.generate(...)` on demand.
- **Build time:** `scripts/pregen.ts` (Bun) calls the *same* `generate` over a fixed seed list and
  writes a static fallback bundle.

**Live generation is primary.** The pre-generated bundle exists for (a) an **instant first puzzle**
on load and (b) a **safety net** when live generation exceeds the latency budget on weak devices.

**Fallback chain** (worker): requested difficulty → closest achievable difficulty → baked-bundle
puzzle → error. The bundle is a **required CI artifact**, regenerated each release, tied to the
engine version. Target size **~5–7 KB gzipped (~40–50 puzzles), capped ~50 KB** — a safety net,
not a content library.

### 4.1 Deduction generation (Sudoku, Tectonic)

Build a full valid solution → remove givens → re-check uniqueness with the oracle after removals →
stop when removing more would break uniqueness or when the target difficulty band is hit.

### 4.2 Kakuro generation (different recipe)

Kakuro has **no removable cell-givens** — its clues are derived sums. Generation: choose
black/run topology → fill a valid solution → derive sum clues → check uniqueness → if non-unique,
**mutate the topology** (add a black cell / split a run), *not* "reveal more givens". Repeat to the
target difficulty.

### 4.3 Greco-Latin (construction mode)

Generate a valid Greco-Latin square for order *n* (n ≠ 6), reveal a partial set of pairs as the
starting board. There is **no uniqueness guarantee**; the player is scored on completing a *valid*
configuration (`validate()` checks both Latin projections + pair-distinctness). The size selector
hard-excludes n = 6.

## 5. Worker protocol

Discriminated messages: `generate` / `progress` / `result` / `error` / `cancel`.

- **Timeout** per generate request; on timeout, run the fallback chain (§4).
- **Cancel** via `AbortSignal` — the engine checks `signal.aborted` at backtracking checkpoints
  (same checkpoint cadence that informs the latency budget), so cancel preempts a deep search.
- **Progress** events for a determinate-ish spinner.
- All payloads must be **structured-clone-serialisable** (plain objects/arrays — no class
  instances, no `Map`/`Set` on the wire; serialise those explicitly).

## 6. Performance & latency budget

TS-first. Concrete budget: live generation should return within **~400 ms on first attempt**;
exceeding it triggers the fallback chain. Profile on a mid-range mobile baseline (e.g. iPhone SE /
Pixel 4a). Kakuro is the highest risk (combinatorial topology generation); measure it early. WASM
(Rust) is a **later optimisation**, adopted only if a puzzle consistently blows the budget — not a
v1 task.

## 7. Play UI, state & persistence

- **Routes:** `/` (picker + difficulty), `/play/[type]`, `/daily`, `/stats`, `/settings`.
  Static-adapter prerendered.
- **Play screen — Stacked layout** (chosen via visual mockup): grid on top, on-screen number pad +
  tool row below; scales up to desktop. Keyboard input on desktop, touch pad on mobile.
- **Game state (Svelte 5 runes):** `instance`, `userGrid`, `notes` (per-cell candidate sets),
  `selected`, `history` (undo/redo), `timer`, `settings`. `$derived` for conflicts/errors and the
  solved check; debounce if a validation pass becomes heavy.
- **Features:** pencil notes; undo/redo + erase; **toggleable** error highlight; **optional** hints;
  timer; difficulty select. Construction mode (Greco-Latin) shows a **live validity meter** instead
  of error-vs-solution highlighting.
- **Persistence (localStorage, versioned):**
  - In-progress game (grid, notes, history, elapsed), keyed by type — auto-saved, resume on return.
  - Per-type stats: solved count, best/avg time by difficulty.
  - Settings (theme, error-highlight, auto-notes, etc.).
  - An **engine-version field** gates migration; a generator change invalidates stale saves and the
    fallback bundle. Cap undo history (e.g. 50 steps) to bound storage.

## 8. Retention

- **Daily puzzle:** `/daily` generates from `seed = hash(type, 'daily', YYYY-MM-DD)` → identical for
  everyone, no backend.
- **Share card:** result encoded in a URL hash + a client-generated image
  (e.g. "Sudoku · 2026-06-14 · 4:12 · no hints"). The link drops a friend onto the same seed.
- Streak: deferred (localStorage-only, fast-follow).

## 9. Testing strategy

- **Unit (Vitest):** solvers — oracle finds exactly 1 solution for a unique puzzle and detects ≥2
  for an ambiguous one; DLX cover/uncover invariants.
- **Property-based (`fast-check`):** generators — *uniqueness invariant* (every generated deduction
  puzzle has exactly one solution); **seed determinism** (same seed + engine version ⇒ byte-identical
  puzzle); generation/solve within the latency bound.
- **Integration:** worker protocol — timeout, cancel, fallback chain, serialisation round-trip.
- **Difficulty rater:** validate against known/benchmark puzzle sets per type; refine post-launch.

## 10. Build sequencing

1. **Engine seams + Sudoku end-to-end:** `core` (prng, dlx, uniqueness, types, difficulty enum),
   Sudoku module, Worker + protocol, play UI (Stacked), persistence, daily, share card,
   `scripts/pregen.ts`. Proves the full vertical slice.
2. **Tectonic:** the shared CSP/backtracking utilities emerge concretely here (with two real solvers
   to factor from). Validates the framework generalises beyond exact-cover.
3. **Kakuro:** hybrid solver, topology-mutation generation, split-clue-cell render.
4. **Greco-Latin (construction mode):** dual-grid render, `validate()` scoring, n ≠ 6.

## 11. Tech stack

SvelteKit (static adapter) · TypeScript · Bun (runtime, package manager, build) · Vite (with
`?worker` import for the Worker) · Vitest + fast-check. Deploy: any static host (e.g. Cloudflare
Pages).

## 12. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| Kakuro generation slow / combinatorial | Measure early; topology-mutation recipe; fallback bundle; WASM only if budget blown |
| Engine accidentally uses runtime globals → build/worker divergence | Lint rule + dedicated tsconfig + determinism property test |
| Difficulty miscalibrated across types | Per-type rater validated on benchmark sets; bands calibrated per type |
| Premature abstraction (CSP framework, all unions up front) | Sudoku uses DLX directly; CSP core + later union arms emerge per puzzle |
| Greco-Latin unsolvable/unfair | Construction mode (no uniqueness), n = 6 excluded |
| localStorage schema drift across versions | Versioned schema + migration; engine-version field |

## Appendix — Design process

This design was pressure-tested by a model-diverse council (Opus 4.8 architect, Sonnet 4.6
red-team, Haiku 4.5 feasibility — Fable 5 was unavailable). Outcomes folded in above: drop
Greco-Latin as a *deduction* puzzle (kept by the user as *construction* mode instead), DLX is
Sudoku-only with a CSP-first core, two-solver separation, hardened worker protocol with a
pre-generated fallback, `kind`-discriminated DeductionPuzzle/ConstructionPuzzle interface,
`render` as a function of state, optional `getHint`, and YAGNI deferral of the generic CSP
framework until Tectonic.
