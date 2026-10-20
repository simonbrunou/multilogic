# Conventions

## Grid cell accessibility

Each grid component (`SudokuGrid`, `KakuroGrid`, `TectonicGrid`, `YakusoGrid`, `GrecoBoard`) renders a `role="grid"` container. Every selectable cell is a `<button>`, and the selected cell carries `aria-current="true"`. Most cells that can never be selected are `<div role="gridcell">`: Yakuso givens, auto-zeros and totals, and every Kakuro black cell. Greco is the exception: its fully-given cells stay `<button>`s with `tabindex="-1"`, `GrecoStore.select()` ignores them, and `greco-board.test.ts` counts them among the n×n cell buttons.

Keep selectable cells as buttons:

- `aria-selected` is invalid on a button.
- `role="gridcell"` would replace the button role that `tests/components/sudoku-grid.test.ts` and `greco-board.test.ts` query with `getByRole('button')`. `e2e/smoke.spec.ts` also selects Yakuso input cells as `button.cell.input`.
- A `<div>` cell loses native Enter/Space activation, and `grid-nav.ts` handles arrow keys only.

No grid has `role="row"` wrappers today: cells sit directly under `role="grid"`. A move to `role="gridcell"` + `aria-selected` has to add them and rewrite those tests.

## Safari / WebKit

No check here runs WebKit. CI (`.forgejo/workflows/ci.yml`) installs Chromium only, and runs both the vitest `browser` project (`vitest.config.ts`) and the Playwright e2e suite (`playwright.config.ts` declares no projects, so Chromium) on it. Locally, Playwright treats the Arch-based dev host as an unknown distro: it downloads a fallback Ubuntu 24.04 WebKit build that needs `libicu74` (the host ships a newer ICU), and `--with-deps` only knows apt, so WebKit won't run.

Write Safari-safe CSS up front, as in `YakusoGrid.svelte`: `repeat(n, minmax(0, 1fr))` columns and `min-width: 0; padding: 0` on cells, because WebKit won't shrink `aspect-ratio` buttons below min-content. The other four grids still use `repeat(n, 1fr)`, so copy Yakuso, not them. Report a Safari-only fix as verified in Chromium only, and ask the user to confirm on a device.
