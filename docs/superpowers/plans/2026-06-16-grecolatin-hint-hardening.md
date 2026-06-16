# Greco-Latin Hint Solver Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Greco-Latin hint's grid-completion solver fast and bounded so a hint can never freeze the UI — the prerequisite for offering larger orders (n=7/8/9) as harder Greco puzzles.

**Architecture:** Replace `hint.ts`'s naive fixed-cell-order backtracker (which tries all n² (a,b) pairs per cell with an O(n²) global pair-scan, and can take seconds at n≥7) with an **MRV** solver over the existing `candidatesAt` model (always expand the empty cell with the fewest candidates; short-circuit on forced singles), plus a hard **step cap** so the worst case is bounded — on overflow the hint gives up gracefully (returns null) rather than hanging.

**Tech Stack:** TypeScript (engine-pure), Vitest, Bun. Pre-commit fallow gate (no dead exports, no `fallow-ignore`, complexity ≤20).

**Scope:** `src/engine/puzzles/grecolatin/hint.ts` only. This does NOT change the offered order (Greco stays n=5 in generation); it clears the prerequisite so larger orders can be enabled later. The candidate model (`analyze`/`candidatesAt`) already lives in `grecolatin/candidates.ts` and is reused.

---

### Task 1: MRV + bounded completion solver

**Files:**
- Modify: `src/engine/puzzles/grecolatin/hint.ts`
- Test: `tests/engine/puzzles/grecolatin/hint.test.ts`

- [ ] **Step 1: Write the failing/perf test**

Add to `tests/engine/puzzles/grecolatin/hint.test.ts` (add imports as needed: `hintCell` from `'../../../../src/engine/puzzles/grecolatin/hint'`, `buildSquare` from `'../../../../src/engine/puzzles/grecolatin/generator'`, `analyze`/`candidatesAt` from `'../../../../src/engine/puzzles/grecolatin/candidates'`, `decodePair` from `'../../../../src/engine/puzzles/grecolatin/rules'`, `createPrng` from core, types as needed):

```ts
  it('hintCell returns a legal move quickly on a sparse large (8x8) grid (no freeze)', () => {
    const sol = buildSquare(8, createPrng(5))!;
    const givens = sol.map((v, i) => (i < 6 ? v : 0)); // only 6 givens, 58 empty
    const cells = new Array(64).fill(0);
    const r = hintCell({ n: 8, givens }, cells);
    expect(r).not.toBeNull();
    expect(givens[r!.index]).toBe(0); // points at an empty cell
    // the suggested value is a legal candidate at that cell
    const an = analyze(8, givens);
    const p = decodePair(r!.value, 8)!;
    expect(candidatesAt(8, an, r!.index).some((c) => c.a === p.a && c.b === p.b)).toBe(true);
  });

  it('hintCell completes a near-empty 9x9 grid without hanging', () => {
    const sol = buildSquare(9, createPrng(2))!;
    const givens = sol.map((v, i) => (i < 5 ? v : 0));
    const r = hintCell({ n: 9, givens }, new Array(81).fill(0));
    expect(r).not.toBeNull(); // bounded solver returns a move (or null) — never hangs
  });
```

(Vitest's per-test timeout — 5s default — fails the test if the OLD solver hangs at n=8/9, demonstrating the need. The new bounded MRV solver returns near-instantly.)

- [ ] **Step 2: Run, observe the old solver is slow/at-risk**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/hint.test.ts`
Expected: the new n=8/n=9 tests are very slow or time out under the current naive `complete()` (or pass slowly). Note the behavior. (If they happen to pass slowly, that still motivates the bound; proceed.)

- [ ] **Step 3: Replace `complete()` with the MRV + capped solver**

In `src/engine/puzzles/grecolatin/hint.ts`, replace the entire `complete` function (lines ~6–29, including its inline `ok` helper) with:

```ts
/**
 * MRV backtracking completion of the empty cells, bounded by a step cap so a hint
 * can never freeze the UI (even at large orders / very sparse grids). Always expands
 * the empty cell with the fewest candidates (forced singles first). Returns a
 * completed grid, or null if none is found within the cap.
 */
function complete(n: number, grid: number[]): number[] | null {
  const work = [...grid];
  let steps = 0;
  const CAP = 200_000;
  const rec = (): boolean => {
    if (++steps > CAP) return false;
    const an = analyze(n, work);
    let target = -1;
    let bestCands: { a: number; b: number }[] | null = null;
    for (let i = 0; i < n * n; i++) {
      if (work[i] !== 0) continue;
      const cands = candidatesAt(n, an, i);
      if (cands.length === 0) return false; // dead end → backtrack
      if (bestCands === null || cands.length < bestCands.length) {
        target = i;
        bestCands = cands;
        if (cands.length === 1) break; // forced — cannot do better than 1 candidate
      }
    }
    if (target === -1) return true; // no empties left → solved
    for (const c of bestCands!) {
      work[target] = encodePair(c.a, c.b, n);
      if (rec()) return true;
      work[target] = 0;
    }
    return false;
  };
  return rec() ? work : null;
}
```

`decodePair` stays imported (still used by `getHint`); `encodePair`, `analyze`, `candidatesAt` are all already imported. The inline `ok` helper is gone (subsumed by `candidatesAt`).

- [ ] **Step 4: Run, expect pass (fast)**

Run: `bun run test:unit tests/engine/puzzles/grecolatin/hint.test.ts`
Expected: PASS, and the n=8/n=9 tests now finish near-instantly. If a test still fails, report it. If the n=9 sparse case ever returns null at the cap (legitimately couldn't complete within 200k steps), raise `CAP` to 1_000_000 and re-run; if still null, STOP and report (the MRV solver should complete a satisfiable Greco grid well within the cap — a null would indicate a logic error).

- [ ] **Step 5: Confirm behavior unchanged at n=5 + full suite**

Run: `bun run test:unit && bun run check:engine && bun run lint`
Expected: all green — existing n=5 hint tests still pass (forced-single path unchanged; completion path now MRV but still returns a valid move), no dead code (`ok` removed), clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/puzzles/grecolatin/hint.ts tests/engine/puzzles/grecolatin/hint.test.ts
git commit -m "perf(grecolatin): MRV + step-capped hint completion (safe at large orders)"
```

---

## Self-Review

**Goal coverage:** MRV + step cap → Task 1 (replaces the naive backtracker; cap bounds the worst case so a hint cannot freeze). Verified fast at n=8/9 (Step 1 tests).

**Placeholder scan:** No TBD/TODO; full code in the implementation step; the perf test relies on vitest's timeout to catch a hang, with an explicit CAP-raise/escalation path if the solver ever returns null on a satisfiable grid.

**Type consistency:** `complete(n, grid): number[] | null` keeps its signature and sole caller (`hintCell`). Reuses `analyze`/`candidatesAt` (from `candidates.ts`) and `encodePair`/`decodePair` (from `rules.ts`), all already imported. `hintCell`/`getHint` unchanged. `CAP` is a local const.

**Out of scope (noted):** actually offering larger orders (changing the generator's order-by-difficulty) is a separate, product-facing follow-up; this only clears the freeze-risk prerequisite.
