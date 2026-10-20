# multilogic

## Agent skills

### Issue tracker

Forgejo issues on `git.sbrn.eu` via the `fj` CLI, with the REST API for JSON reads and blocking links. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## Conventions

### Grid cell accessibility

Selectable puzzle cells (`SudokuGrid`, `KakuroGrid`, `TectonicGrid`, `YakusoGrid`, `GrecoBoard`) are `<button>`s inside a `role="grid"` container, and the selected cell carries `aria-current="true"`. Only cells that can never be selected (Yakuso givens, auto-zeros and totals, Kakuro clue cells) are `<div role="gridcell">`. Keep selectable cells as buttons: `aria-selected` is invalid on a button, and `role="gridcell"` would replace the button role that `tests/components/sudoku-grid.test.ts` and `greco-board.test.ts` query with `getByRole('button')`. A move to `role="gridcell"` + `aria-selected` also needs `role="row"` wrappers and rewritten tests.

### Safari / WebKit

No check here runs WebKit: CI installs Chromium only (`.forgejo/workflows/ci.yml`, plus the `browser` project in `vitest.config.ts`), and Playwright's WebKit build needs Ubuntu-pinned libraries, so it won't install on the Arch-based dev host. Write Safari-safe CSS up front, as in `YakusoGrid.svelte`: `repeat(n, minmax(0, 1fr))` columns and `min-width: 0; padding: 0` on cells, because WebKit won't shrink `aspect-ratio` buttons below min-content. Report a Safari-only fix as verified in Chromium only, and ask the user to confirm on a device.
