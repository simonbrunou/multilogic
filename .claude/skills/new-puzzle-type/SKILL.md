---
name: new-puzzle-type
description: Scaffold a new puzzle type end-to-end in multilogic — engine module, registry wiring, play UI, routes, i18n, and the mirrored test tree. Use when the user asks to add a new puzzle (e.g. "add a nonogram/futoshiki puzzle type"), create a puzzle variant, or wire a new puzzle into the engine and UI.
---

# Add a puzzle type to multilogic

Reference types: `sudoku`, `tectonic`, `kakuro`, `grecolatin`, `yakuso`. `sudoku`
(deduction) and `grecolatin` (construction) are the cleanest templates. Mirror an
existing type of the same `kind`. **All engine code must obey purity** — no
DOM/globals/`Math.random`; randomness via the injected `PRNG` (a hook blocks violations).

## 0 — classify
- **Deduction** (unique solution, rateable, hintable): implement `DeductionPuzzle`
  (`solveComplete`, `rate`). Mirror `sudoku`.
- **Construction** (build-to-satisfy, no single solution): implement `ConstructionPuzzle`
  (`validate`). Mirror `grecolatin`. See `src/engine/core/types.ts`.

## 1 — engine module `src/engine/puzzles/<type>/`
Mirror an existing dir (`types.ts`, `rules.ts`, `solver.ts`, `generator.ts`, `rater.ts`,
`hint.ts`, `index.ts`). `index.ts` exports one `PuzzleModule` (`type`, `kind`, `generate`,
serialize/deserialize, `validateMove`, `render`, optional `getHint`, plus `solveComplete`+`rate`
OR `validate`). `generate(args)` draws all randomness from `args.prng` and honors `args.signal`.
Must compile under `tsconfig.engine.json` and pass the engine ESLint block.

## 2 — engine registry
- `src/engine/core/types.ts`: add `'<type>'` to the `PuzzleType` union.
- `src/engine/puzzles/registry.ts`: import + add to `MODULES`.

## 3 — play UI
- `src/lib/components/<Type>Grid.svelte` (Svelte 5 runes; mirror an existing Grid).
- `src/lib/play/<type>-game.ts` implementing `PlayableGame` (mirror `tectonic-game.ts`);
  deduction types on a 1–9 grid can reuse `SudokuGame` from `src/lib/game-core.ts`.
- `src/lib/play/registry.ts`: add a `PLAY_UI['<type>']` entry (`Grid`, `makeGame`,
  `hintProvider` via `makeHintProvider`, `maxDigit`).

## 4 — routes
`play/[type]` and `daily/[type]` resolve dynamically — usually no new route needed. Add the
type to the explicit lists in `src/routes/+page.svelte`, `daily/+page.svelte`, `stats/+page.svelte`.

## 5 — i18n
Add the type's strings to `src/lib/i18n/messages.ts` for every locale (match existing keys).

## 6 — pregen / baked bundle
The type is picked up by `scripts/pregen.ts` via `MODULES`. Bump `ENGINE_VERSION` and run
`bun run pregen` so it appears in `static/puzzles.bundle.json` (which you must NOT hand-edit).

## 7 — tests (mirror `tests/engine/puzzles/<sibling>/`)
`generator.test.ts`, `solver.test.ts` (deduction), `rater.test.ts`, `hint.test.ts`,
`module.test.ts`; add the type to `tests/engine/puzzles/registry.test.ts`. Include a
**seed-reproducibility** test (same seed → identical serialized instance) and, where
solver-backed, a uniqueness assertion. Prefer fast-check property tests like the existing suites.

## Verify
`bun run check:engine && bun run lint && bun run test && bun run pregen`. Then run the
`determinism-reviewer` agent on the new generator.
