# Greco-Latin Partial Clues — design

**Date:** 2026-06-16
**Status:** Ratified by model-diverse council (Opus 4.8 architect / Sonnet 4.6 red-team / Haiku 4.5 feasibility) — unanimous RATIFY-WITH-NITS after one reconciliation round. Soundness of the per-dimension propagation was the contested point and is **confirmed sound** (red-team conceded); a **Phase-0 measurement gate** and expanded scope were added (this is v2 — see §11). Pending user review.
**Author:** brainstorming session
**Origin:** User insight — "the difficulty comes from having only seeded letters or digits sometimes." Adds partial clues as a richer difficulty lever for Greco-Latin. (Larger orders were discussed but **deferred** — this ships partial clues at the existing order n=5.)

## 1. Summary

A Greco-Latin cell holds a **digit** (`a`, shown `1..n`) and a **letter** (`b`, shown `A..`). Today a clue (given) always reveals the **full pair**. This feature lets a clue reveal **just the digit, just the letter, or both** — a partial clue gives less information, forcing cross-projection deduction (the two orthogonal Latin squares must be reasoned about together). Difficulty stays **rating-driven**: the residual-free-ratio rater is generalized to partial clues, generation floors to the rated band, and `achievedDifficulty` remains the honest measured difficulty. Order stays **n=5**.

## 2. Goals / non-goals

**Goals**
- A clue can be digit-only, letter-only, or full.
- The construction-difficulty rating (residual-free-ratio) honestly accounts for partial clues.
- Generation produces partial-clue puzzles floored to the requested band; partial clues act as a finer difficulty knob that should **un-squeeze the middle bands** (medium/hard were sparse under full-pair reveal-ratio alone).
- The UI renders partial clues (the locked dimension shown as a given; the other dimension editable). Most of this already exists — the player UI already tracks digit/letter independently.

**Non-goals**
- Larger orders (n=7/8/9) — deferred (the hint solver was already hardened to make them safe later).
- Changing the deduction puzzles or the technique framework — Greco remains a construction puzzle rated by residual-free-ratio.
- A unique-solution guarantee — Greco-Latin remains multi-solution by nature.

## 3. Data model

Replace the single full-pair `givens` array with two per-dimension clue arrays:

```ts
export interface GrecoLatinInstance {
  n: number;
  digitClues: (number | null)[];   // length n*n; given digit a ∈ 0..n-1, or null (open)
  letterClues: (number | null)[];  // length n*n; given letter b ∈ 0..n-1, or null (open)
}
```

- Both null → open cell. One non-null → partial clue (that dimension is locked). Both non-null → full clue.
- This maps directly onto the play store's existing `digits`/`letters` arrays: a clue simply pre-locks one or both dimensions.
- (Alternative considered and rejected: a single `givens` array with a 2-bit "which dimension is known" mask — more compact but opaque; two explicit arrays are clearer and align with the player model.)

`GrecoLatinSolution` stays `null` (construction puzzle, no stored solution).

## 4. Candidate model generalization (`candidates.ts`)

`analyze`/`candidatesAt` (shared by the rater and the hint solver) currently operate on a grid of **full pairs**. Generalize them to **per-dimension known state** — separate known-`a` and known-`b` per cell:

- `analyze(n, knownA, knownB)`: builds, per row and per column, the sets of already-known `a` values and `b` values; and the set of globally-used **pairs** (only cells where *both* `a` and `b` are known contribute a used pair).
- `candidatesAt(n, an, knownA, knownB, i)`: legal `(a,b)` pairs for cell `i` — `a` is fixed to `knownA[i]` if set, else any value not in the cell's row/col known-`a` sets; `b` likewise; and the pair `(a,b)` must not be globally used.

The existing full-pair behavior is the special case where every known cell has both dimensions. This is the one non-trivial engine change; it is well-bounded (one module, pure functions) and unit-testable in isolation.

## 5. Rating (`rater.ts`) — residual-free-ratio over partial state

`residualFreeRatio` generalizes to propagate **forced singles per dimension**, not only full pairs:

- Maintain per-cell candidate sets for `a` and `b` seeded from the clues.
- Propagate to a fixpoint using three sound, guess-free rules:
  1. **a-Latin completion** — a known `a` excludes that value from other cells in its row/col; a cell whose `a`-candidates shrink to one is fixed.
  2. **b-Latin completion** — same for `b`.
  3. **pair-distinctness coupling** — a used `(a,b)` pair is removed from other cells' candidate pairs, which can shrink an `a` or `b` set to one.
- A cell is *determined* when both `a` and `b` are fixed. **residual = fraction of originally-undetermined cells still undetermined after propagation.** 0 = fully deducible (easy); 1 = pure guessing (hard).

This is sound (only fixes a value when it is the unique legal option, so it can never rule out a valid completion), cheap, and — crucially — it now captures the cross-projection deduction that partial clues create (e.g. a digit clue advances the `a`-square independently of letters). Band cut points (currently 0.05 / 0.47 / 0.97) are **recalibrated** against the new partial-clue distribution; the bimodality may soften because partial clues give finer granularity than full-pair reveal-ratio.

## 6. Generation (`generator.ts`) — floored, partial-clue mix at n=5

- Build a full valid square (`buildSquare(5, prng)` — unchanged).
- Reveal a set of cells; each revealed cell is **full / digit-only / letter-only** (a mix). Two knobs seed the search: how many cells to reveal, and what fraction of reveals are partial — both varied by target band as a starting point (more partial / fewer cells ⇒ harder).
- **Floor:** rate the candidate instance via the generalized `residualFreeRatio`; re-roll the reveal set + partial mix until the rated band matches the target (else return the closest), up to a bounded attempt budget. `achievedDifficulty` = the real rating.
- Greco generation is cheap (<1 ms build + rate), so the floor's retries are inexpensive. Partial clues expand the reachable difficulty space, which should raise medium/hard yields relative to full-pair-only reveal.

## 7. UI & validation

- **Validation unchanged:** `validateGrid(n, cells)` still validates the complete full-pair grid. The play store merges digit/letter clues into the locked state; a cell counts only when both dimensions are filled (by clue or player).
- **Play store (`greco.svelte.ts`):** `load()` seeds `digits`/`letters` from `digitClues`/`letterClues` (a partial clue locks one dimension); `select`/`setDigit`/`setLetter`/`clear` must treat a dimension as locked iff its clue is non-null (a partial-clue cell is still selectable to fill the *open* dimension). The `givens[i] !== 0` "is this a given" test is replaced by per-dimension locked checks.
- **Board (`GrecoBoard.svelte`):** a cell renders its digit and/or letter; a clued dimension is styled as a *given* (e.g. the existing `given` class applied per-dimension), the open dimension editable. `cellText` already renders partial state. A fully-open and a partially-clued cell must be visually distinguishable.
- **Hint (`hint.ts`):** the forced-single and MRV-completion paths consume the generalized candidate model; a hint may now fill a single dimension of a partial-clue cell.

## 8. Migration & serving

- The instance shape changes (`givens` → `digitClues`/`letterClues`), so **bump the engine/bundle version**; `scripts/pregen.ts` regenerates the bundle; the worker/daily/share paths are seed-based and regenerate fresh — no long-lived serialized instances to migrate. `serializeInstance`/`deserializeInstance` (JSON) handle the new shape automatically.
- The render model (`render()`) passes `digitClues`/`letterClues` instead of `givens`.

## 9. Testing

- **Candidate model:** unit-test `analyze`/`candidatesAt` on hand-built partial states (digit-only clue restricts `a`; letter-only restricts `b`; a forced single emerges from a partial clue).
- **Rater:** all-full-given ⇒ ratio 0 ⇒ easy; all-open ⇒ ratio 1 ⇒ expert; a partial-clue instance rates between; determinism; recalibrated cuts.
- **Generator:** `achievedDifficulty === rate(instance)` (honesty); produced clues are a valid partial revelation of a real square; bands reachable within the attempt budget; partial clues actually appear.
- **Soundness:** propagation never fixes a value inconsistent with the source square (cross-check against the generating solution).
- **UI:** component test that a partial-clue cell locks one dimension and accepts input on the other.

## 10. Risks

- **Candidate-model refactor blast radius** — `analyze`/`candidatesAt` are used by both rater and hint; the generalization must preserve full-pair behavior exactly (covered by keeping/porting existing tests). Mitigated by isolating the change to `candidates.ts` with focused unit tests.
- **Calibration** — the residual-ratio distribution under partial clues is unmeasured; cuts are recalibrated empirically during implementation (as for the other types). If the middle stays squeezed, the floor + closest-fallback still serve honestly.
- **UI per-dimension locking** — the store's "is given" logic moves from whole-cell to per-dimension; must ensure a partial-clue cell is selectable for its open dimension but rejects edits to the locked one.

## 11. Council resolution & build sequence (v2)

Unanimously ratified after one reconciliation round. Folded-in changes:

**Soundness — CONFIRMED (was the contested point).** The per-dimension forced-single propagation is sound on satisfiable (real-square-derived) instances. Exclusion sets are built only from *known* values; a partial cell is transparent to the orthogonal projection, so candidate sets are a **superset** of the truly-reachable set — propagation can only *under*-propagate (miss deductions), never *false*-fix. A size-1 computed candidate set therefore equals the (non-empty) true set, so the survivor is entailed by every completion. (The round-1 "false fix via a transparent letter-only cell" was internally inconsistent: the value claimed wrongly-excluded would instead survive as a *second* candidate, blocking the fix.) Implementation constraint: the propagation must **re-`analyze` after each placement, or fix at most one single per pass** — a defensive guard against a stale per-pass snapshot once the pair-distinctness coupling rule can shrink an `a`/`b` set mid-pass. A **gating** soundness cross-check test (propagation never fixes a value ≠ the generating square) is required.

**Phase 0 — measurement gate (build this FIRST, before any UI).** Prototype the generalized `analyze`/`candidatesAt` + per-dimension `residualFreeRatio` + partial-clue generation, then **measure the residual-ratio distribution** across a (reveal-count × partial-fraction) grid at n=5 (e.g. ~8×5×50 trials, ~seconds). **Go/no-go:** do partial clues populate the medium/hard bands materially better than full-pair reveal-ratio (which is bimodal: easy/medium median ≈0, hard/expert ≈0.94/1.0), or is the distribution still bimodal? If still bimodal, **surface to the user** before building the UI — the feature still adds variety + an honest rating, but its primary justification (un-squeezing the middle) would not have materialized, and larger orders (deferred) may be the better lever. Recalibrate band cuts here.

**Expanded scope (round-1 found the spec under-counted these):**
- `index.ts` `validate` / `validateMove` / `render` all read `inst.givens` and must move to the per-dimension model.
- Both route pages call `store.load(inst.n, inst.givens)` — update to the new shape.
- **`GrecoLatinMove` decision:** the move type is whole-pair `{index, value}` with no per-dimension granularity. **Decision: per-dimension locking lives in the play store** (which already drives `setDigit`/`setLetter` directly); `validateMove` (engine) rejects a move only on a **fully-given** cell (both dimensions clued) — partial-clue cells are editable in their open dimension via the store, which enforces the per-dimension lock. The move type does **not** gain a dimension field (YAGNI).

**UI is a real task, not "mostly free":** per-dimension locking in the store (`select`/`setDigit`/`setLetter`/`clear`, centralized in `isDigitGiven(i)`/`isLetterGiven(i)` helpers so the lock test lives in one place); board **per-token rendering** (the clued dimension styled as a given, the open one editable — `cellText`'s concatenated string must become per-token elements); `gridKeyboard` focusable predicate = "at least one dimension open"; a fully-given cell is a non-selectable no-op.

**Hint:** when a hint fills only the open dimension of a partial-clue cell, the hint text names just that dimension ("Place digit Y" / "Place letter X"), not both.

**Added tests:** end-to-end — a partial-clue instance reaches `complete: true, valid: true`; serialization round-trip with `null` clues; per-dimension store locking (selectable for open dim, rejects locked dim); the gating soundness cross-check.

**Build sequence:** Phase 0 (gate) → Phase 1 engine (data model, candidates generalization with ported regression tests, rater per-dimension propagation + soundness cross-check, generator floor, `index.ts`) → Phase 2 UI (store per-dimension locking, board per-token render, keyboard nav, hint text, route pages) → Phase 3 (engineVersion bump + bundle regen, extended tests, manual play-test). Write tests first per phase (TDD).

## 12. Result — shipped (2026-06-16)

Implemented engine + UI; `bun run check` 0 errors, 239 unit + 13 browser tests green. The instance model is `{ n, digitClues, letterClues }`; the candidate model and rater are per-dimension; generation reveals a full/partial mix floored to the real rating; the play UI locks clued dimensions per cell-dimension (per-token board rendering). Soundness was independently verified twice (council proof + a 40-seed cross-check vs the generating square — 0 false fixes).

**Difficulty outcome (honest):** partial clues deliver a genuinely-hard, reachable Greco band (residual ~0.85, requiring real cross-projection deduction) — the primary win, since `hard` was effectively unreachable before. At n=5, however, the `medium` and `hard` residual medians both land ~0.85 and do **not** separate cleanly, so `medium` stays squeezed and is served by closest-fallback (still honest — `achievedDifficulty` is always the measured `rate`). easy ≈ 0, expert ≈ 1. **Follow-up to separate medium/hard:** enable larger orders (n=7/8/9) — the hint solver was already hardened (bounded) to make that safe; the order knob is the lever the n=5 board can't provide.

**Deferred (non-blocking nits from final review):** digit-picker `aria-label` (a11y parity with letters); a DOM-level test asserting picker `disabled` bindings.
