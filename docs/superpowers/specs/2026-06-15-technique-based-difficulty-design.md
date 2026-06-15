# Technique-based difficulty rating — design

**Date:** 2026-06-15
**Status:** Ratified by model-diverse council (Opus 4.8 architect / Sonnet 4.6 red-team / Haiku 4.5 feasibility) — unanimous RATIFY-WITH-NITS. All nits folded into this spec as v3.
**Author:** brainstorming session
**Origin:** User report — "People are finding the puzzles too easy," specifically *even at the highest `expert` setting in free play*.

## 1. Summary

Replace the puzzle difficulty metric from **machine backtracking effort** to **human solving-technique difficulty**, across all four deduction puzzle types (Sudoku, Tectonic, Kakuro, Yakuso). Greco-Latin keeps its reveal-ratio model and is out of scope.

A puzzle's difficulty becomes **the hardest deduction technique a human must use to solve it** (with a secondary bump for puzzles that need many hard steps), not how many guesses a brute-force solver needs. This makes `hard`/`expert` genuinely demanding: a puzzle requiring an X-wing rates `expert` even though a machine cracks it with zero guesses.

## 2. Problem

Difficulty is currently `bandFromEffort(effort, t1, t2)` (`src/engine/core/difficulty.ts`), where `effort` is the guess count of an MRV backtracking solver (`src/engine/core/effort.ts`). Two consequences:

- **The metric is invisible to humans.** A puzzle needing an X-wing or chain (hard for people) often needs zero machine guesses → rates `easy`/`medium`.
- **The `expert` cutoff sits at ~P75 of randomly-dug puzzles** (Sudoku `T2 = 48`, with the dug distribution's P75 ≈ 48). "Expert" is neither rare nor technique-demanding.

Critically, **`rate()` is the lever that also drives generation** — each generator's dig loop calls `rate()` to bound difficulty. So changing the metric propagates to what gets generated and served, *provided generation is changed too* (see §6). Today the Sudoku and Tectonic technique ladders (`solveWithTechniques`, returning `hardestRank`) already exist but are **dead code** — `rate()` ignores them.

## 3. Goals / non-goals

**Goals**
- Difficulty bands reflect human technique difficulty for all four deduction types.
- `expert` reliably requires advanced techniques (or is unsolvable by the implemented ladder).
- Generation actually *produces* puzzles at the requested band; the player receives them (live or via a trustworthy fallback bundle).

**Non-goals**
- Greco-Latin rating changes (stays reveal-ratio / construction mode).
- A 5th difficulty tier (user declined; 4 bands retained).
- Changing the daily puzzle's wiring beyond the one-line difficulty fix in §8.
- A labeled human-difficulty research dataset; calibration is against the engine's own technique-rank distribution plus hand-built fixtures.

## 4. Core model: technique-based rating

New shared module **`src/engine/core/technique-rating.ts`**:

```ts
interface Technique<Ctx> { name: string; rank: number; apply(ctx: Ctx): boolean } // true if it made progress
interface TechniqueRater<Ctx> {
  ladder: Technique<Ctx>[];          // ordered cheapest → hardest, each rank-tagged
  bandForRank(rank: number): Difficulty;
  topRankStepThreshold: number;      // per-type; bump one band when exceeded
}
interface TechniqueTrace { solved: boolean; hardestRank: number; topRankSteps: number }

solveByTechniques(ctx, ladder): TechniqueTrace
rateByTechniques(rater, ctx): Difficulty
```

**Solve loop:** repeatedly apply the **lowest-rank technique that makes progress**, restarting the scan from rank 1 after each step. Track `hardestRank` (the highest rank ever used) and `topRankSteps` (count of steps taken at that hardest rank). Every step must strictly reduce candidate count or place a cell, or the loop breaks — non-progress is an invariant violation for a returned `Step`.

**Band assignment:**
- If `solved`: `band = bandForRank(hardestRank)`, then **bump up one band** if `topRankSteps > topRankStepThreshold` (captures "many hard steps feel harder than one"). The bump cannot exceed `expert`.
- If **not solved** by the ladder (requires reasoning beyond the *top implemented rank*): `band = expert`.

**Hard rule — no phantom expert:** a type's `rate()` may only flip to technique-based **after** the ladder implements *every technique its band table cites*. "Unsolved" must mean "beyond the hardest technique we built," never "uses a technique we forgot." This is enforced by a unit test asserting the ladder's max rank ≥ the max rank referenced by `bandForRank`.

## 5. Per-type ladders and band tables

Each type defines a ladder and a transparent `bandForRank`. `expert` = the top band or unsolved-by-ladder.

| Type | Ladder (rank → technique) | `bandForRank` |
|---|---|---|
| **Sudoku** | 1 singles · 2 locked candidates · 3 naked/hidden pairs · 4 naked/hidden triples · 5 X-wing · 6 XY-wing/swordfish · 7 chains | easy ≤1 · medium ≤2 · hard ≤4 · expert ≥5 or unsolved |
| **Tectonic** | 1 naked single · 2 hidden single · 3 locked candidates (region↔line) · 4 naked pair | easy ≤1 · medium ≤2 · hard ≤3 · expert ≥4 or unsolved |
| **Kakuro** | 1 forced cell · 2 unique sum-combo · 3 cross-run intersection · 4 combo elimination | easy ≤1 · medium ≤2 · hard ≤3 · expert ≥4 or unsolved |
| **Yakuso** | 4 ranks, **specified empirically before coding** (see §7) | easy ≤1 · medium ≤2 · hard ≤3 · expert ≥4 or unsolved |

Sudoku reuses and *replaces* the existing `LADDER`/`Step`/`apply` machinery in `sudoku/rater.ts` (currently dead) rather than building a parallel structure. The band cut points are provisional and recalibrated against the new rank distribution in Phase 4; the table above is the starting hypothesis.

## 6. Generation: making the band real

`rate()` flipping is necessary but **not sufficient** — generation must produce puzzles in-band.

**Dig loop (unchanged shape):** keep the greedy, monotone, **upper-bound (ceiling)** pass each generator already has: remove a clue only if the puzzle stays uniquely solvable and doesn't exceed the target band. The per-removal check stays cheap (see perf note).

**Floor (new), enforced at the seed level — never per-removal:** a per-removal floor is non-monotone (a later removal can raise difficulty) and would deadlock the dig. Instead: dig the seed to its ceiling as today, then check the floor *once*. If `achieved < target`, **discard the whole seed and retry** via `generateWithFallback` (`src/engine/core/generate.ts`).

**No silent downgrade:** when the floor cannot be met within `maxAttempts`, live generation **throws** rather than returning a closest-but-easier puzzle. The worker lets the error propagate; `puzzle-service` then falls back to the **bundle** (§9), which is guaranteed in-band by a build-time assertion. `maxAttempts` is raised per type as measurement dictates (e.g. Kakuro 12 → ~30 given its low per-attempt success rate).

**Kakuro generator rewrite (required):** Kakuro's generator currently does `void target;` and ignores difficulty entirely — its label is purely post-hoc. It gets a real difficulty-targeted dig (ceiling + seed-level floor), wired through `generateWithFallback`.

**Performance — the dig-time cost.** `rate()` runs on every candidate removal. Proving a removal keeps the puzzle *within* a hard band requires running the deep ladder (you cannot cheaply prove hardness — to show rank ≥5 is needed you must show ranks 1–4 are insufficient). Mitigation, gated by a **Phase 0 benchmark (hard go/no-go)**:
- If full-ladder generation fits the latency budget (live worker timeout ~4–6s; pregen is offline and unbounded) → use the technique ladder throughout.
- If not → **per-removal ceiling checks use the cheap effort metric** (`measureEffort`) as a fast proxy, and the **full technique ladder runs once per finished seed** for the authoritative rating + floor check. The authoritative `achievedDifficulty` and the bundle's `achieved` field are always the technique-based rating; the effort proxy is only a dig-time accelerator.

**Floor reachability:** for small boards (Tectonic, Kakuro, Yakuso) a type may have *no* seed reaching `expert` under its ladder. This is surfaced loudly by the build-time assertion (§9), and is the signal to lower that type's `expert` cut in `bandForRank` — not to ship a mislabeled puzzle.

### P0 benchmark result (2026-06-15)

Ran `scripts/bench-difficulty.ts` (20 runs per band, budget 2000 ms) on `feat/difficulty-p0-framework-sudoku`:

```
easy    mean=12.0ms max=29.9ms hitRate=100%
medium  mean=9.9ms  max=11.8ms hitRate=5%
hard    mean=10.2ms max=13.0ms hitRate=15%
expert  mean=12.5ms max=20.5ms hitRate=35%

GATE: worst mean 12.5ms vs budget 2000ms -> PASS — keep full ladder in dig loop
```

**Perf gate: PASS.** Worst mean across all bands is 12.5 ms, well under the 2000 ms budget. Full-ladder-during-dig is confirmed viable; no effort-proxy split is needed in P4.

**Band reachability finding:** hitRate for medium/hard/expert is 5 %, 15 %, and 35 % respectively. Generation mis-targets these bands because only a ceiling (upper bound) is enforced during the dig — the seed-level FLOOR that discards under-difficult seeds is not yet implemented. This is by design: P0 delivers the rater and framework only. The floor (§6) is a P4 deliverable; until then, a request for `medium`, `hard`, or `expert` frequently produces an `easy` puzzle. The hitRate numbers here are the baseline that P4's floor implementation must improve.

### P4 result — generation floor (2026-06-15)

**Mechanism shipped:** `generateForDifficulty` now digs to a ceiling (removes clues while difficulty stays ≤ target) and then relaxes back to the target floor (re-adds clues until the puzzle is exactly in-band or no more can be added). The module `sudoku.generate()` wraps this in a 60-attempt retry loop and throws on failure; `puzzle-service` catches the throw and falls back to the in-band bundle. Bundle `PER_DIFFICULTY` raised to 3, and `pickFromBundle` now selects by `achieved` difficulty.

**Measured single-call `generateForDifficulty` yield (20 runs per band):**

```
easy    mean=11.3ms max=33.9ms hitRate=100%
medium  mean=8.5ms  max=10.5ms hitRate=15%
hard    mean=8.4ms  max=11.0ms hitRate=5%
expert  mean=8.7ms  max=11.1ms hitRate=35%

GATE: worst mean 11.3ms vs budget 2000ms -> PASS — keep full ladder in dig loop
```

**Measured module `generate()` end-to-end reliability (60-attempt loop, 20 runs per band):**

```
Module generate() end-to-end (60-attempt loop, exact-or-throw):
easy    exact=100% threw=0%  9ms/req
medium  exact=100% threw=0%  62ms/req
hard    exact=100% threw=0%  111ms/req
expert  exact=100% threw=0%  18ms/req
```

**Conclusion:** Players now reliably receive in-band puzzles. The module end-to-end success rate is 100 % across all bands — no throws observed — meaning the 60-attempt loop absorbs the per-attempt miss rates (15 %, 5 %, 35 % for medium, hard, expert respectively) and always finds an in-band puzzle before exhausting attempts. The residual throw path (bundle fallback) exists for adversarial seeds and remains a correctness safety net, not a production path. This closes the P0 gap where a request for `medium`/`hard`/`expert` frequently returned an `easy` puzzle.

The modest single-call yield for `hard` (5 %) reflects an uneven technique-rank distribution (few randomly-dug seeds land in the hard band), which is a **band-calibration question** — the `bandForRank` cut points are working hypotheses — not a correctness issue. Recalibrating cuts or enriching the generator's dig strategy are noted follow-ups.

### P1 result — Tectonic (2026-06-15)

**Spec correction applied:** Tectonic has only region-uniqueness + king-move (8-neighbour) adjacency — **no rows/columns**, so §5's "locked candidates (region↔line)" was inapplicable. Shipped king-aware ladder: **1 naked single · 2 hidden single in region · 3 naked pair in region · 4 king-pointing** (a digit whose region-candidate cells are all king-adjacent to a cell X ⇒ X ≠ that digit). Band table: easy ≤1 · medium ≤2 · hard ≤4 · expert = unsolved by the ladder. Adopts the shared framework + dig-to-minimal/relax floor + exact-band-or-throw module loop; reuses P4's hardened bundle/serving layer.

**Measured (15 runs per band):**

```
        singleYield   module exact / threw   ms/req
easy     100%          100% / 0%             30
medium    27%          100% / 0%             46
hard      67%          100% / 0%             44
expert    20%          100% / 0%             66
```

Bundle: all 12 Tectonic entries in-band (3 per band). **Conclusion:** Tectonic delivers in-band puzzles reliably (100 % module exact, all bands). Its single-call distribution is more even than Sudoku's (king-pointing at rank 4 gives a meatier `hard` band, 67 %), so calibration is less pressing here. The technique soundness (no false eliminations, incl. king-pointing) was independently verified.

### P3 result — Kakuro (pragmatic 2-band, 2026-06-15)

**Investigation finding:** Kakuro difficulty is **bimodal** — an empirical sweep of generated 6×6 puzzles found ~70 % forced-cell-only (easy), ~1 % forced-digit (medium), ~30 % combo-elimination (expert), with the middle bands essentially empty. Larger grids shift toward expert but generate poorly and make combo-elimination expensive. **User-approved decision: ship pragmatic ~2-band Kakuro** rather than fabricate four tiers.

**Shipped:** a sound 3-rank **combination-aware** ladder — **1 forced cell · 2 forced digit (digit in every run-combo with one home) · 3 combo-elimination (no consistent run completion)**. Kakuro has **no givens**, so the dig-to-minimal/relax floor does not apply; difficulty is topology-driven. Crucially, Kakuro **keeps closest-fallback (NOT throw-on-miss)** — its bands aren't all reachable, so an in-band-or-bust contract would fail the build; unreachable requests degrade to the nearest reachable band (and the achieved-difficulty bundle from P4 serves likewise). `bandForRank` is honest (easy≤1/medium≤2/expert) and the step-count bump is disabled. The combination engine's soundness (no false eliminations/placements) was independently verified via the invariant that candidate sets always remain supersets of the unique solution.

**Measured:** raw `rate()` over 120 random topologies = {easy 87, medium 0, hard 0, expert 33}. Module achieved-band per request (10 runs): `easy→easy` (1ms), `medium→` mostly easy +rare medium (184ms), `hard→expert` (194ms), `expert→expert` (5ms). **Conclusion:** "too easy" is solved for Kakuro — a `hard` or `expert` request reliably yields a genuinely-hard combo-elimination puzzle; `medium` honestly serves the (near-absent) middle as the closest reachable band. The medium/hard latency (~190ms) reflects exhausting 60 attempts for a rare band before returning closest — well within budget.

## 7. Yakuso ladder specification (pre-coding step)

Yakuso currently rates by `effortToSolve` (guess-branch count), not techniques. Before implementing its ladder:
1. Generate ~40 `expert`-target Yakuso instances with the existing generator.
2. Measure the effort/structure distribution; manually inspect ~15 to identify the genuine deduction tiers (e.g. forced row placement, column-capacity elimination, row-digit-count saturation, digit-uniqueness).
3. Define 4 rank-tagged techniques matching observed tiers; the ladder must be a real technique progression, not "thresholded effort wearing a ladder costume."
4. Recalibrate `bandForRank` cuts against the measured rank distribution.

## 8. Additive quick win (ships alongside)

`src/routes/daily/[type]/+page.svelte:58` hardcodes daily difficulty to `'medium'`. Replace with a per-type/per-date `dailyDifficulty(...)` (or at minimum bump to `'hard'`) so daily players ever encounter the harder bands the rating work produces. This does not address the expert-free-play complaint directly but is near-free value all council seats endorsed. Kept independent of the engine changes so it can land separately.

## 9. Migration & serving

- **Bundle hardening (`scripts/pregen.ts`, `src/lib/puzzle-service.ts`):**
  - `PER_DIFFICULTY` raised from 1 to **≥3** so a single unlucky puzzle no longer represents an entire tier on timeout fallback.
  - `pickFromBundle` selects by **`achieved`** difficulty (random among matches), not `requested`.
  - **Build-time assertion** in `buildBundle`: for each `(type, 'expert')` slot, `achieved === 'expert'` — throws at CI if a type can't reach its top band, making §6's reachability risk loud rather than silent.
- **Regenerate `static/puzzles.bundle.json`** after the rater changes (old entries carry stale bands).
- **Effort module:** `measureEffort` is retained (it may serve as the dig-time proxy per §6) but is no longer the *authoritative* difficulty source. The old `T1`/`T2` per-type thresholds are removed from the difficulty path.

## 10. Testing strategy

- **Per-technique unit tests:** a hand-built position the technique must crack, plus a control it must *not* fire on. Critical for the from-scratch Kakuro techniques (sum-combo enumeration is the highest-bug-risk surface).
- **Solution cross-check:** every technique-solved grid must equal the puzzle's known unique solution (guards against a buggy technique silently placing a wrong digit and reporting `solved`).
- **Known-difficulty fixtures:** curated puzzles per band per type; assert `rate()` classifies each into its expected band.
- **Generation distribution:** assert each type *actually produces* `expert` at an `expert` target as a **batch hit-rate** (not a single call — `generateWithFallback` makes single calls flaky), and that bands are ordered easy ≤ … ≤ expert.
- **Ladder-coverage test:** ladder max rank ≥ max rank referenced by `bandForRank` (enforces §4's no-phantom-expert rule).
- **Bundle test:** every bundle puzzle deserializes, solves uniquely, and rates in its `achieved` band; expert slots assert `achieved === 'expert'`.

## 11. Phasing

- **P0 — Framework + Sudoku + benchmark gate.** Build `technique-rating.ts`; implement Sudoku's full cited ladder (triples → X-wing → XY-wing/swordfish → chains); flip Sudoku `rate()`. **Run the dig-time perf benchmark — go/no-go** for full-ladder-during-dig vs. effort-proxy split (§6).
- **P1 — Tectonic.** Add naked pair (rank 3→4 coverage); flip `rate()`.
- **P2 — Yakuso.** Ladder spec (§7) **first**, then implement; flip `rate()`. (Sequenced before Kakuro per feasibility seat — lower blast radius.)
- **P3 — Kakuro.** New technique solver (forced cell → combo elimination) **and** difficulty-targeted generator rewrite; flip `rate()`. Highest effort/risk, sequenced last.
- **P4 — Migration.** Bundle hardening + regeneration; recalibrate band cuts against the new rank distribution; add fixtures and assertions.

The additive daily fix (§8) and bundle hardening (§9) may land independently of the per-type work.

## 12. Risks & open items

- **Perf (Sudoku):** deep ladder per removal during expert generation is the main cost; resolved by the P0 benchmark gate (§6).
- **Kakuro correctness:** from-scratch sum-combo techniques are bug-prone and mis-rate silently; mitigated by per-technique tests + solution cross-check.
- **Floor reachability on small boards:** mitigated by the build-time assertion forcing a band-cut recalibration rather than a mislabel.
- **Calibration credibility:** band cuts start as hypotheses; Phase 4 recalibrates against the engine's measured rank distribution and the fixtures. There is no external human-labeled dataset.
- **Live variety degradation:** if expert live-gen throws often → repeated bundle puzzles; mitigated by raised `maxAttempts` and `PER_DIFFICULTY ≥ 3`.
