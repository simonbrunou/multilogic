# Greco-Latin Partial Clues — design

**Date:** 2026-06-16
**Status:** Brainstormed; pending user review.
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
